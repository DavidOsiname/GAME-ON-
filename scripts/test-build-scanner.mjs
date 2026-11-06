import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workerPath = path.join(root, 'services/build-scanner/worker.mjs');
const workerSource = fs.readFileSync(workerPath, 'utf8');
assert.match(workerSource, /import \{\s*once\s*\} from ['"]node:events['"]/ , 'Scanner backpressure handler must import Node once().');
const fixture = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00]);
const webhookSecret = 'local-scanner-test-secret-only-32-bytes';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

function createClamMock(reply) {
  const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0);
    let commandRead = false;
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!commandRead) {
        const end = buffer.indexOf(0);
        if (end < 0) return;
        const command = buffer.subarray(0, end).toString('ascii');
        assert.equal(command, 'zINSTREAM');
        buffer = buffer.subarray(end + 1);
        commandRead = true;
      }
      while (commandRead && buffer.length >= 4) {
        const size = buffer.readUInt32BE(0);
        if (size === 0) {
          socket.write(Buffer.from(reply, 'utf8'));
          socket.end();
          return;
        }
        if (buffer.length < 4 + size) return;
        buffer = buffer.subarray(4 + size);
      }
    });
  });
  return server;
}

async function runScenario(reply, expectedResult, inputFixture = fixture) {
  const buildId = '54f7a9c8-9d8d-4e9d-8d0b-9c5f1f3bb001';
  let build = {
    id: buildId,
    game_id: '64f7a9c8-9d8d-4e9d-8d0b-9c5f1f3bb002',
    object_path: 'studio/game/build.apk',
    file_size_bytes: inputFixture.length,
    original_file_name: 'game.apk',
    platform: 'android',
    scan_status: 'quarantined',
    scan_attempts: 0,
    upload_status: 'uploaded',
  };
  let callback = null;

  const api = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const send = (status, value) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(value));
    };
    if (url.pathname === '/rest/v1/game_builds' && request.method === 'GET') {
      assert.equal(request.headers.apikey, 'sb_secret_test-local-only');
      assert.equal(request.headers.authorization, undefined, 'New secret keys must not be sent as Bearer JWTs.');
      if (url.searchParams.get('scan_status') === 'eq.quarantined' && build.scan_status === 'quarantined') return send(200, [build]);
      return send(200, []);
    }
    if (url.pathname === '/rest/v1/game_builds' && request.method === 'PATCH') {
      assert.equal(request.headers.apikey, 'sb_secret_test-local-only');
      assert.equal(request.headers.authorization, undefined, 'New secret keys must not be sent as Bearer JWTs.');
      let body = '';
      for await (const part of request) body += part;
      const data = JSON.parse(body || '{}');
      if (url.searchParams.get('id') === `eq.${buildId}` && url.searchParams.get('scan_status') === `eq.${build.scan_status}`) {
        build = { ...build, ...data };
        return send(200, [build]);
      }
      return send(200, []);
    }
    if (url.pathname.startsWith('/storage/v1/object/authenticated/game-build-quarantine/')) {
      response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': inputFixture.length });
      return response.end(inputFixture);
    }
    if (url.pathname === '/api/internal/build-scan' && request.method === 'POST') {
      let body = '';
      for await (const part of request) body += part;
      callback = JSON.parse(body || '{}');
      assert.equal(request.headers.authorization, `Bearer ${webhookSecret}`);
      assert.equal(callback.buildId, buildId);
      assert.match(callback.workerId, /^[0-9a-f-]{36}$/i);
      build.scan_status = callback.result;
      build.scan_worker_id = null;
      return send(200, { ok: true });
    }
    return send(404, { error: 'not found' });
  });
  const clam = createClamMock(reply);
  const apiPort = await listen(api);
  const clamPort = await listen(clam);
  const child = spawn(process.execPath, [workerPath], {
    cwd: root,
    env: {
      ...process.env,
      SUPABASE_URL: `http://127.0.0.1:${apiPort}`,
      SUPABASE_SECRET_KEY: 'sb_secret_test-local-only',
      GAMEON_CREATOR_BASE_URL: `http://127.0.0.1:${apiPort}`,
      GAMEON_SCANNER_WEBHOOK_SECRET: webhookSecret,
      CLAMAV_HOST: '127.0.0.1',
      CLAMAV_PORT: String(clamPort),
      SCANNER_POLL_MS: '250',
      SCANNER_BATCH_SIZE: '1',
      CLAMAV_TIMEOUT_MS: '5000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (chunk) => { logs += chunk.toString(); });
  child.stderr.on('data', (chunk) => { logs += chunk.toString(); });
  try {
    const deadline = Date.now() + 8000;
    while (!callback && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(callback, `Scanner did not call back. Logs: ${logs}`);
    assert.equal(callback.result, expectedResult);
    assert.match(callback.sha256, /^[a-f0-9]{64}$/);
    assert.ok(callback.report.length > 0);
  } finally {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    api.close();
    clam.close();
  }
}

await runScenario('stream: OK\0', 'clean');
await runScenario('stream: Eicar-Test-Signature FOUND\0', 'rejected');
await runScenario('stream: OK\0', 'rejected', Buffer.from('not-an-apk-file'));
console.log('Scanner integration checks passed: private object streaming, backpressure-helper import guard, lease-bound callback, SHA-256 digest, clean result, malware rejection and invalid file-signature rejection.');
