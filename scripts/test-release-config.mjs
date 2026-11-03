import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['scripts/verify-release-config.mjs'], { encoding: 'utf8' });
if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
  process.exit(1);
}
const output = `${result.stdout}\n${result.stderr}`;
const expectedChecks = [
  'Root npm workspaces include Store and Creator.',
  'Payments are disabled by default in both app templates.',
  'No server-only service/payment secrets are exposed through NEXT_PUBLIC variables.',
  'CI runs source tests, typechecks and both app production builds.',
  'CI applies migrations and runs pgTAP database tests.',
  'ClamAV is exposed only on the private Compose network.',
  'Scanner container runs as a non-root user.',
  'CI exports its genuine generated root lockfile artifact.',
  'Root package-lock.json is present.'
];
const missing = expectedChecks.filter((check) => !output.includes(check));
if (missing.length) {
  console.error(`Release-config checks missing expected results:\n${missing.join('\n')}\n\nVerifier output:\n${output}`);
  process.exit(1);
}
const summary = output.match(/Release configuration:\s*(\d+)\s+passed,\s*(\d+)\s+blocked\./i);
if (!summary || Number(summary[2]) !== 0) {
  console.error(`Release-config verifier did not report zero blockers.\n\nVerifier output:\n${output}`);
  process.exit(1);
}
console.log(`Release-config verification test passed (${expectedChecks.length} checks observed; ${summary[1]} passed, 0 blocked).`);
