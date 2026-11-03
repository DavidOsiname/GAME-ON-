import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
const expected = Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(4, '0'));
const actual = files.map((name) => name.slice(0, 4));
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Migration sequence must be contiguous 0001–0010. Found: ${actual.join(', ')}`);
}
const entitlementMigration = fs.readFileSync(path.join(migrationsDir, '0010_protect_paid_entitlements_and_private_ledgers.sql'), 'utf8');
for (const marker of ['library_insert_free_or_demo_only', 'library_delete_free_or_demo_only', 'revoke all on public.game_builds', 'revoke all on public.download_events']) {
  if (!entitlementMigration.toLowerCase().includes(marker.toLowerCase())) throw new Error(`Entitlement security migration is missing: ${marker}`);
}
const testFile = path.join(root, 'supabase', 'tests', 'marketplace_security.test.sql');
if (!fs.existsSync(testFile)) throw new Error('Supabase pgTAP marketplace security tests are missing.');
const testSql = fs.readFileSync(testFile, 'utf8');
for (const marker of ['plan(26)', 'complete_marketplace_order', 'marketplace_orders', 'refund_requests', 'game-build-quarantine', 'notifications_read_own']) {
  if (!testSql.includes(marker)) throw new Error(`Database security test file is missing expected assertion: ${marker}`);
}
const config = fs.readFileSync(path.join(root, 'supabase', 'config.toml'), 'utf8');
if (!config.includes('project_id = "game-on-ecosystem"') || !config.includes('major_version = 17')) {
  throw new Error('Supabase local configuration is incomplete or inconsistent.');
}
console.log(`Migration verification passed: ${files.length} contiguous migrations, local Supabase configuration and pgTAP security tests present.`);
