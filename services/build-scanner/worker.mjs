import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import net from 'node:net';

const MAX_BUILD_BYTES = 50 * 1024 * 1024;
const POLL_MS = Number(process.env.SCANNER_POLL_MS || 5000);
const BATCH_SIZE = Math.min(20, Math.max(1, Number(process.env.SCANNER_BATCH_SIZE || 3)));
const STALE_AFTER_MS = Number(process.env.SCANNER_STALE_AFTER_MS || 15 * 60 * 1000);
const CLAMAV_TIMEOUT_MS = Number(process.env.CLAMAV_TIMEOUT_MS || 180000);
for (const [name, value, min, max] of [
  ['SCANNER_POLL_MS', POLL_MS, 250, 300000],
  ['SCANNER_BATCH_SIZE', BATCH_SIZE, 1, 20],
  ['SCANNER_STALE_AFTER_MS', STALE_AFTER_MS, 60000, 86400000],
  ['CLAMAV_TIMEOUT_MS', CLAMAV_TIMEOUT_MS, 1000, 900000],
]) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}.`);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let stopping = false;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const config = {
  supabaseUrl: required('SUPABASE_URL').replace(/\/$/, ''),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  creatorBaseUrl: required('GAMEON_CREATOR_BASE_URL').replace(/\/$/, ''),
  webhookSecret: required('GAMEON_SCANNER_WEBHOOK_SECRET'),
  clamavHost: process.env.CLAMAV_HOST || 'clamav',
  clamavPort: Number(process.env.CLAMAV_PORT || 3310),
};

if (config.webhookSecret.length < 32) throw new Error('GAMEON_SCANNER_WEBHOOK_SECRET must be at least 32 characters.');
const supabaseUrl = new URL(config.supabaseUrl);
if (supabaseUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(supabaseUrl.hostname)) {
  throw new Error('SUPABASE_URL must use HTTPS outside localhost.');
}
const creatorUrl = new URL(config.creatorBaseUrl);
if (creatorUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(creatorUrl.hostname)) {
  throw new Error('GAMEON_CREATOR_BASE_URL must use HTTPS outside localhost.');
}
if (!Number.isInteger(config.clamavPort) || config.clamavPort < 1 || config.clamavPort > 65535) {
  throw new Error('CLAMAV_PORT must be a valid TCP port.');
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    ...extra,
  };
}

async function rest(path, options = {}) {
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    ...options,
    headers: supabaseHeaders(options.headers || {}),
    signal: AbortSignal.timeout(Number(process.env.SUPABASE_REQUEST_TIMEOUT_MS || 30000)),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase REST ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

function tablePath(query) {
  return `/rest/v1/game_builds?${query}`;
}

async function loadQueue(status, staleCutoff = null) {
  const params = new URLSearchParams({
    select: 'id,game_id,object_path,file_size_bytes,original_file_name,platform,scan_status,scan_attempts',
    upload_status: 'eq.uploaded',
    scan_status: `eq.${status}`,
    order: 'created_at.asc',
    limit: String(BATCH_SIZE),
  });
  if (staleCutoff) params.set('scan_started_at', `lt.${staleCutoff}`);
  return (await rest(tablePath(params.toString()))) || [];
}

async function claimBuild(build, expectedStatus, staleCutoff = null) {
  const workerId = randomUUID();
  const params = new URLSearchParams({
    id: `eq.${build.id}`,
    upload_status: 'eq.uploaded',
    scan_status: `eq.${expectedStatus}`,
    select: 'id,game_id,object_path,file_size_bytes,original_file_name,platform,scan_attempts',
  });
  if (staleCutoff) params.set('scan_started_at', `lt.${staleCutoff}`);
  const claimed = await rest(tablePath(params.toString()), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      scan_status: 'scanning',
      scan_started_at: new Date().toISOString(),
      scan_worker_id: workerId,
      scan_attempts: Number(build.scan_attempts || 0) + 1,
      scan_report: staleCutoff ? 'A previous scanner lease expired; the build was claimed again.' : null,
    }),
  });
  return claimed?.[0] ? { ...claimed[0], workerId } : null;
}

async function fetchQuarantinedObject(objectPath) {
  const encoded = objectPath.split('/').map(encodeURIComponent).join('/');
  const url = `${config.supabaseUrl}/storage/v1/object/authenticated/game-build-quarantine/${encoded}`;
  const response = await fetch(url, {
    headers: supabaseHeaders(),
    signal: AbortSignal.timeout(Number(process.env.OBJECT_FETCH_TIMEOUT_MS || 120000)),
  });
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Unable to read private quarantine object (${response.status}): ${detail.slice(0, 300)}`);
  }
  return response;
}

function writeSocket(socket, data) {
  if (socket.destroyed) return Promise.reject(new Error('ClamAV socket closed unexpectedly.'));
  if (socket.write(data)) return Promise.resolve();
  return once(socket, 'drain').then(() => undefined);
}

async function sendToClamAV(readable, expectedBytes) {
  const socket = net.createConnection({ host: config.clamavHost, port: config.clamavPort });
  socket.setNoDelay(true);
  let socketError = null;
  socket.on('error', (error) => { socketError = error; });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('Timed out connecting to ClamAV.'));
    }, 15000);
    socket.once('connect', () => { clearTimeout(timer); resolve(); });
    socket.once('error', (error) => { clearTimeout(timer); reject(error); });
  });

  const responsePromise = new Promise((resolve, reject) => {
    const parts = [];
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('ClamAV scan timed out.'));
    }, CLAMAV_TIMEOUT_MS);
    socket.on('data', (chunk) => parts.push(Buffer.from(chunk)));
    socket.once('end', () => { clearTimeout(timer); resolve(Buffer.concat(parts).toString('utf8').replace(/\0/g, '').trim()); });
    socket.once('error', (error) => { clearTimeout(timer); reject(error); });
    socket.once('close', () => {
      if (parts.length) { clearTimeout(timer); resolve(Buffer.concat(parts).toString('utf8').replace(/\0/g, '').trim()); }
    });
  });

  const hash = createHash('sha256');
  const prefixParts = [];
  let prefixBytes = 0;
  let totalBytes = 0;
  try {
    await writeSocket(socket, Buffer.from('zINSTREAM\0', 'ascii'));
    const reader = readable.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      if (!chunk.length) continue;
      totalBytes += chunk.length;
      if (totalBytes > MAX_BUILD_BYTES || totalBytes > expectedBytes) throw new Error('The uploaded object exceeded its declared or configured size limit.');
      hash.update(chunk);
      if (prefixBytes < 16) {
        const take = chunk.subarray(0, 16 - prefixBytes);
        prefixParts.push(take);
        prefixBytes += take.length;
      }
      const header = Buffer.allocUnsafe(4);
      header.writeUInt32BE(chunk.length, 0);
      await writeSocket(socket, header);
      await writeSocket(socket, chunk);
    }
    const eof = Buffer.alloc(4);
    await writeSocket(socket, eof);
    socket.end();
    const clamReply = await responsePromise;
    if (socketError) throw socketError;
    if (!clamReply) throw new Error('ClamAV returned an empty scan response.');
    if (/\bERROR\b/i.test(clamReply) || /size limit exceeded/i.test(clamReply)) throw new Error(`ClamAV could not complete the scan: ${clamReply}`);
    if (!/\bOK\b/.test(clamReply) && !/\bFOUND\b/.test(clamReply)) throw new Error(`Unexpected ClamAV response: ${clamReply}`);
    if (totalBytes !== expectedBytes) throw new Error(`Object size mismatch: expected ${expectedBytes} bytes, received ${totalBytes}.`);
    return {
      sha256: hash.digest('hex'),
      bytes: totalBytes,
      prefix: Buffer.concat(prefixParts),
      clamReply,
      infected: /\bFOUND\b/.test(clamReply),
    };
  } catch (error) {
    socket.destroy();
    throw error;
  }
}

function hasExpectedFileSignature(platform, filename, prefix) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (platform === 'android' || platform === 'web' || ext === 'zip' || ext === 'aab' || ext === 'apk') {
    return prefix.length >= 4 && prefix[0] === 0x50 && prefix[1] === 0x4b && [0x03, 0x05, 0x07].includes(prefix[2]);
  }
  if (ext === 'exe') return prefix.length >= 2 && prefix[0] === 0x4d && prefix[1] === 0x5a;
  if (ext === 'msi') return prefix.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  return false;
}

async function postScanResult(build, result, sha256, report) {
  const response = await fetch(`${config.creatorBaseUrl}/api/internal/build-scan`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.webhookSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ buildId: build.id, workerId: build.workerId, result, sha256, report }),
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Scanner callback failed (${response.status}): ${text.slice(0, 500)}`);
}

async function markFailed(build, error) {
  const detail = String(error?.message || error).slice(0, 1800);
  try {
    await rest(tablePath(new URLSearchParams({ id: `eq.${build.id}`, scan_status: 'eq.scanning', scan_worker_id: `eq.${build.workerId}`, select: 'id' }).toString()), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ scan_status: 'failed', scan_report: `Scanner could not complete: ${detail}`, scan_worker_id: null, scan_started_at: null }),
    });
  } catch (updateError) {
    console.error(`[scanner] Could not mark build ${build.id} failed:`, updateError.message);
  }
  console.error(`[scanner] Build ${build.id} failed: ${detail}`);
}

async function processBuild(build) {
  console.log(`[scanner] Scanning ${build.id} (${build.platform}, ${build.file_size_bytes} bytes), attempt ${build.scan_attempts}.`);
  try {
    const response = await fetchQuarantinedObject(build.object_path);
    const result = await sendToClamAV(response.body, Number(build.file_size_bytes));
    const validSignature = hasExpectedFileSignature(build.platform, build.original_file_name || '', result.prefix);
    const rejected = result.infected || !validSignature;
    const report = result.infected
      ? `ClamAV detected malware: ${result.clamReply.slice(0, 700)}`
      : !validSignature
        ? `File signature did not match the declared platform or extension (${build.platform}, ${build.original_file_name || 'unknown filename'}).`
        : `ClamAV scan clean. SHA-256: ${result.sha256}. File signature check passed.`;
    await postScanResult(build, rejected ? 'rejected' : 'clean', result.sha256, report);
    console.log(`[scanner] Build ${build.id}: ${rejected ? 'REJECTED' : 'CLEAN'} (${result.bytes} bytes).`);
  } catch (error) {
    await markFailed(build, error);
  }
}

async function runOnce() {
  const queue = await loadQueue('quarantined');
  for (const row of queue) {
    if (stopping) return;
    const build = await claimBuild(row, 'quarantined');
    if (build) await processBuild(build);
  }
  const staleCutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const stale = await loadQueue('scanning', staleCutoff);
  for (const row of stale) {
    if (stopping) return;
    const build = await claimBuild(row, 'scanning', staleCutoff);
    if (build) await processBuild(build);
  }
}

async function main() {
  console.log('[scanner] Game ON quarantined-build scanner worker started.');
  console.log(`[scanner] ClamAV ${config.clamavHost}:${config.clamavPort}; poll ${POLL_MS}ms; batch ${BATCH_SIZE}; file cap ${MAX_BUILD_BYTES} bytes.`);
  while (!stopping) {
    try { await runOnce(); }
    catch (error) { console.error('[scanner] Queue poll failed:', error.message); }
    if (!stopping) await sleep(POLL_MS);
  }
  console.log('[scanner] Worker stopped.');
}

process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

main().catch((error) => { console.error('[scanner] Fatal configuration or startup error:', error.message); process.exitCode = 1; });
