import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const passes = [];
const check = (condition, pass, fail) => (condition ? passes : failures).push(condition ? pass : fail);
const npmVersionResult = spawnSync('npm', ['--version'], { encoding: 'utf8' });
const npmVersion = npmVersionResult.status === 0 ? npmVersionResult.stdout.trim() : 'unavailable';
const npmMajor = Number(npmVersion.split('.')[0]);
check(Number.isFinite(npmMajor) && npmMajor >= 10, `npm ${npmVersion} meets the minimum version (>=10).`, `npm ${npmVersion} is unavailable or older than 10.`);
const nodeParts = process.versions.node.split('.').map(Number);
const nodeOk = (nodeParts[0] > 22 || (nodeParts[0] === 22 && nodeParts[1] >= 12)) && nodeParts[0] < 25;
check(nodeOk, `Node.js ${process.versions.node} is within the supported range (>=22.12 <25).`, `Node.js ${process.versions.node} is unsupported; use Node.js >=22.12 and <25.`);
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

try {
  const rootPkg = readJson('package.json');
  const storePkg = readJson('apps/store/package.json');
  const creatorPkg = readJson('apps/creator/package.json');
  check(rootPkg.workspaces?.includes('apps/store') && rootPkg.workspaces?.includes('apps/creator'), 'Root npm workspaces include Store and Creator.', 'Root npm workspaces must include both independent apps.');
  check(storePkg.name === '@game-on/store' && creatorPkg.name === '@game-on/creator', 'Store and Creator have distinct workspace identities.', 'Store and Creator workspace identities are missing or duplicated.');
  check(rootPkg.version === storePkg.version && rootPkg.version === creatorPkg.version, `All package versions match (${rootPkg.version}).`, 'Root, Store and Creator package versions must match.');
  for (const [name, pkg] of [['Store', storePkg], ['Creator', creatorPkg]]) {
    check(Boolean(pkg.scripts?.build && pkg.scripts?.typecheck), `${name} defines build and typecheck scripts.`, `${name} is missing a build or typecheck script.`);
    check(Boolean(pkg.dependencies?.next && pkg.dependencies?.react && pkg.dependencies?.['@supabase/supabase-js']), `${name} declares Next.js, React and Supabase dependencies.`, `${name} is missing a required runtime dependency.`);
  }

  const storeEnv = read('apps/store/.env.example');
  const creatorEnv = read('apps/creator/.env.example');
  const scannerEnv = read('services/build-scanner/.env.example');
  const allTemplates = [storeEnv, creatorEnv, scannerEnv].join('\n');
  check(storeEnv.includes('GAMEON_PAYMENTS_ENABLED=false') && creatorEnv.includes('GAMEON_PAYMENTS_ENABLED=false'), 'Payments are disabled by default in both app templates.', 'Payments must remain disabled by default in both app templates.');
  check(storeEnv.includes('GAMEON_LIVE_PAYMENTS_APPROVED=false') && creatorEnv.includes('GAMEON_LIVE_PAYMENTS_APPROVED=false'), 'Live payments require an explicit approval switch.', 'Live payment approval must be false by default in both app templates.');
  check(!/^NEXT_PUBLIC_.*(?:SERVICE_ROLE|SECRET|PAYSTACK_SECRET)/m.test(allTemplates), 'No server-only service/payment secrets are exposed through NEXT_PUBLIC variables.', 'A server-only secret appears under a NEXT_PUBLIC variable.');
  check(creatorEnv.includes('GAMEON_ADMIN_USER_IDS=') && creatorEnv.includes('GAMEON_SCANNER_WEBHOOK_SECRET='), 'Creator template includes admin and scanner configuration placeholders.', 'Creator template is missing admin/scanner configuration placeholders.');
  check(scannerEnv.includes('SUPABASE_SERVICE_ROLE_KEY=') && scannerEnv.includes('GAMEON_SCANNER_WEBHOOK_SECRET='), 'Scanner template uses server-side credentials and a shared callback secret.', 'Scanner template is missing required server-side configuration.');

  const ignore = read('.gitignore');
  check(ignore.includes('.env') && ignore.includes('.env.local') && ignore.includes('services/build-scanner/.env'), 'Git ignore rules exclude local environment secrets.', 'Git ignore rules must exclude app and scanner environment files.');
  const workflow = read('.github/workflows/ci.yml');
  check(workflow.includes('npm test') && workflow.includes('npm run typecheck') && workflow.includes('npm run build'), 'CI runs source tests, typechecks and both app production builds.', 'CI workflow must run tests, typechecks and production builds.');
  check(workflow.includes('supabase db reset') && workflow.includes('supabase test db'), 'CI applies migrations and runs pgTAP database tests.', 'CI workflow must reset the Supabase database and run pgTAP tests.');

  const migrationDir = path.join(root, 'supabase/migrations');
  const migrations = fs.readdirSync(migrationDir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
  const expected = Array.from({ length: migrations.length }, (_, i) => `${String(i + 1).padStart(4, '0')}_`);
  check(migrations.length >= 10 && migrations.every((f, i) => f.startsWith(expected[i])), `Database migration sequence is contiguous (${migrations.length} files).`, 'Database migration sequence has gaps or fewer than ten migrations.');
  check(fs.existsSync(path.join(root, 'supabase/tests/marketplace_security.test.sql')), 'pgTAP marketplace security tests are present.', 'pgTAP marketplace security tests are missing.');
  check(fs.existsSync(path.join(root, 'services/build-scanner/compose.yaml')), 'Private scanner Compose deployment is present.', 'Scanner Compose deployment file is missing.');
  const compose = read('services/build-scanner/compose.yaml');
  const clamavBlock = compose.split(/\n(?=  [a-zA-Z0-9_-]+:)/).find((b) => b.includes('clamav:')) ?? '';
  check(clamavBlock.includes('expose:') && !/^\s{4}ports:/m.test(clamavBlock), 'ClamAV is exposed only on the private Compose network.', 'ClamAV must not publish a public host port.');
  check(read('services/build-scanner/Dockerfile').includes('USER node'), 'Scanner container runs as a non-root user.', 'Scanner container must run as a non-root user.');
  check(fs.existsSync(path.join(root, 'docker-compose.yml')) && fs.existsSync(path.join(root, 'deploy/Dockerfile.store')) && fs.existsSync(path.join(root, 'deploy/Dockerfile.creator')), 'Separate self-host Store and Creator Docker deployments are present.', 'Self-host deployment is missing one or both application Dockerfiles or Compose configuration.');
  check(fs.existsSync(path.join(root, 'scripts/deploy-self-hosted.sh')) && fs.existsSync(path.join(root, 'deploy/README.md')), 'Self-host deploy script and instructions are present.', 'Self-host deploy script or instructions are missing.');
  check(workflow.includes('actions/upload-artifact@v4') && workflow.includes('package-lock.json'), 'CI exports its genuine generated root lockfile artifact.', 'CI must upload the generated root lockfile so it can be committed after registry resolution.');

  const lockExists = fs.existsSync(path.join(root, 'package-lock.json'));
  if (lockExists) passes.push('Root package-lock.json is present.');
  else failures.push('Root package-lock.json is missing; run npm install in a network-enabled environment and commit it before using npm ci or production release.');
} catch (error) {
  failures.push(`Could not complete release configuration verification: ${error instanceof Error ? error.message : String(error)}`);
}

for (const message of passes) console.log(`PASS  ${message}`);
for (const message of failures) console.error(`BLOCK ${message}`);
console.log(`\nRelease configuration: ${passes.length} passed, ${failures.length} blocked.`);
const strict = process.argv.includes('--strict');
if (failures.length && strict) process.exitCode = 1;
