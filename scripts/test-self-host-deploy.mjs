import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const checks = [];
const check = (ok, label) => checks.push({ ok: Boolean(ok), label });

const storeDocker = read('deploy/Dockerfile.store');
const creatorDocker = read('deploy/Dockerfile.creator');
const compose = read('docker-compose.yml');
const deployScript = read('scripts/deploy-self-hosted.sh');
const ci = read('.github/workflows/ci.yml');
const storeEnv = read('deploy/store.env.example');
const creatorEnv = read('deploy/creator.env.example');
const dockerIgnore = read('.dockerignore');
const caddyfile = read('deploy/Caddyfile');

check(storeDocker.includes('npm run build --workspace=@game-on/store'), 'Store Dockerfile builds only the Store workspace.');
check(storeDocker.includes('npm ci --no-audit --no-fund') && storeDocker.includes('npm install --no-audit --no-fund'), 'Store image prefers the committed lockfile and falls back only during bootstrap.');
check(storeDocker.includes('ARG NEXT_PUBLIC_SUPABASE_URL') && storeDocker.includes('ARG NEXT_PUBLIC_SUPABASE_ANON_KEY') && storeDocker.includes('ARG NEXT_PUBLIC_SITE_URL'), 'Store embeds its public backend and site settings at build time.');
check(creatorDocker.includes('npm run build --workspace=@game-on/creator'), 'Creator Dockerfile builds only the Creator workspace.');
check(creatorDocker.includes('npm ci --no-audit --no-fund') && creatorDocker.includes('npm install --no-audit --no-fund'), 'Creator image prefers the committed lockfile and falls back only during bootstrap.');
check(creatorDocker.includes('ARG NEXT_PUBLIC_SUPABASE_URL') && creatorDocker.includes('ARG NEXT_PUBLIC_SUPABASE_ANON_KEY') && creatorDocker.includes('ARG NEXT_PUBLIC_STORE_URL'), 'Creator embeds its public backend/store settings at build time.');
check(storeDocker.includes('USER node') && creatorDocker.includes('USER node'), 'Both production containers run as the unprivileged node user.');
check(storeDocker.includes('node:22-bookworm-slim') && creatorDocker.includes('node:22-bookworm-slim'), 'Both containers use Node 22 runtime images.');
check(/  store:\n[\s\S]*?dockerfile: deploy\/Dockerfile\.store/.test(compose), 'Compose defines a separate Store service/image.');
check(/  creator:\n[\s\S]*?dockerfile: deploy\/Dockerfile\.creator/.test(compose), 'Compose defines a separate Creator service/image.');
check(compose.includes('${STORE_BIND_ADDRESS:-127.0.0.1}') && compose.includes('${CREATOR_BIND_ADDRESS:-127.0.0.1}'), 'Both public-facing app ports bind to localhost by default.');
check(compose.includes('/api/health') && compose.includes('no-new-privileges:true') && compose.includes('cap_drop:'), 'Compose includes process health checks and container hardening.');
check(dockerIgnore.includes('deploy/*.env') && dockerIgnore.includes('**/.env.*'), 'Docker build context excludes local environment files and secrets.');
check(deployScript.includes('docker compose --env-file deploy/store.env --env-file deploy/creator.env config --quiet') && deployScript.includes('docker compose --env-file deploy/store.env --env-file deploy/creator.env build --pull') && deployScript.includes('docker compose --env-file deploy/store.env --env-file deploy/creator.env up -d'), 'Deployment script loads both env files, validates, builds and starts the Compose stack.');
check(deployScript.includes('YOUR_PROJECT') && deployScript.includes('example\\.com') && deployScript.includes('GAMEON_PAYMENTS_ENABLED=true'), 'Deployment script rejects placeholder domains and prevents early payment activation.');
check(deployScript.includes('STORE_DOMAIN') && deployScript.includes('CREATOR_DOMAIN') && deployScript.includes('== \"$CREATOR_DOMAIN\"'), 'Deployment script requires two distinct Store and Creator hostnames.');
check(storeEnv.includes('GAMEON_PAYMENTS_ENABLED=false') && creatorEnv.includes('GAMEON_PAYMENTS_ENABLED=false'), 'Both deployment environment templates keep payments disabled.');
check(!/^NEXT_PUBLIC_.*(?:SERVICE_ROLE|SECRET|PAYSTACK_SECRET)/m.test(`${storeEnv}\n${creatorEnv}`), 'No server-only payment or Supabase secret is exposed as NEXT_PUBLIC.');
check(ci.includes('actions/upload-artifact@v4') && ci.includes('package-lock.json') && ci.includes('retention-days: 14'), 'CI stores the registry-generated root lockfile as a 14-day artifact.');
check(ci.includes('npm run release:preflight'), 'CI runs strict release configuration preflight.');
check(ci.includes('gh pr create') && ci.includes('contents: write') && ci.includes('pull-requests: write'), 'First network-enabled CI run can push and open a pull request for the genuine lockfile.');
check(compose.includes('image: caddy:2-alpine') && compose.includes('443:443') && compose.includes('80:80'), 'Compose includes a dedicated public HTTPS reverse proxy.');
check(caddyfile.includes('reverse_proxy store:3000') && caddyfile.includes('reverse_proxy creator:3001'), 'Caddy routes the two apps to separate internal services.');
check(compose.includes('caddy_data:/data') && compose.includes('caddy_config:/config'), 'Caddy certificate and configuration data persist across restarts.');

const failures = checks.filter((entry) => !entry.ok);
for (const entry of checks) console.log(`${entry.ok ? 'PASS' : 'FAIL'} ${entry.label}`);
console.log(`\nSelf-host deployment test: ${checks.length - failures.length}/${checks.length} passed.`);
if (failures.length) process.exitCode = 1;
