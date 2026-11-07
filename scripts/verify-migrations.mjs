import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
const expected = Array.from({ length: 13 }, (_, i) => String(i + 1).padStart(4, '0'));
const actual = files.map((name) => name.slice(0, 4));
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Migration sequence must be contiguous 0001–0013. Found: ${actual.join(', ')}`);
}
const entitlementMigration = fs.readFileSync(path.join(migrationsDir, '0010_protect_paid_entitlements_and_private_ledgers.sql'), 'utf8');
for (const marker of ['library_insert_free_or_demo_only', 'library_delete_free_or_demo_only', 'revoke all on public.game_builds', 'revoke all on public.download_events']) {
  if (!entitlementMigration.toLowerCase().includes(marker.toLowerCase())) throw new Error(`Entitlement security migration is missing: ${marker}`);
}
const coverMigration = fs.readFileSync(path.join(migrationsDir, '0011_game_cover_artwork.sql'), 'utf8');
for (const marker of ['game-covers', 'game_covers_owner_insert', 'game_covers_owner_update', 'game_covers_owner_delete', '5242880', 'image/webp', 'cover(-[a-z0-9-]{1,48})?']) {
  if (!coverMigration.toLowerCase().includes(marker.toLowerCase())) throw new Error(`Game cover migration is missing: ${marker}`);
}
const fitMigration = fs.readFileSync(path.join(migrationsDir, '0012_game_fit_platform_details.sql'), 'utf8');
for (const marker of ['game_platform_details', 'official_access_url_verified_at', 'download_size_bytes', 'internet_requirement', 'minimum_requirements', 'supported_languages', 'enable row level security', 'game_platform_details_owner_insert', 'protect_game_platform_detail_verification']) {
  if (!fitMigration.toLowerCase().includes(marker.toLowerCase())) throw new Error(`GAME FIT migration is missing: ${marker}`);
}
const fitVerificationMigration = fs.readFileSync(path.join(migrationsDir, '0013_invalidate_changed_game_fit_verification.sql'), 'utf8');
for (const marker of ['protect_game_platform_detail_verification', 'new.official_access_url_verified_at := null', 'new.download_size_verified_at := null', 'new.internet_requirement_verified_at := null', 'new.minimum_requirements_verified_at := null']) {
  if (!fitVerificationMigration.includes(marker)) throw new Error(`GAME FIT verification migration is missing: ${marker}`);
}
const testFile = path.join(root, 'supabase', 'tests', 'marketplace_security.test.sql');
if (!fs.existsSync(testFile)) throw new Error('Supabase pgTAP marketplace security tests are missing.');
const testSql = fs.readFileSync(testFile, 'utf8');
for (const marker of ['plan(50)', 'game_platform_details', 'official_access_url', 'download_size_bytes', 'internet_requirement', 'protect_game_platform_detail_verification', 'complete_marketplace_order', 'marketplace_orders', 'refund_requests', 'game-build-quarantine', 'game-covers', 'game_covers_owner_insert', 'notifications_read_own']) {
  if (!testSql.includes(marker)) throw new Error(`Database security test file is missing expected assertion: ${marker}`);
}
const config = fs.readFileSync(path.join(root, 'supabase', 'config.toml'), 'utf8');
if (!config.includes('project_id = "game-on-ecosystem"') || !config.includes('major_version = 17')) {
  throw new Error('Supabase local configuration is incomplete or inconsistent.');
}
console.log(`Migration verification passed: ${files.length} contiguous migrations, local Supabase configuration and pgTAP security tests present.`);
