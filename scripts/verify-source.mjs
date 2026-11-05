import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "apps/store/src/app/page.tsx",
  "apps/store/src/components/store-app.tsx",
  "apps/creator/src/components/creator-insights.tsx",
  "apps/creator/src/app/page.tsx",
  "apps/creator/src/app/admin/page.tsx",
  "apps/creator/src/components/admin-review-app.tsx",
  "apps/creator/src/app/api/admin/moderation/route.ts",
  "apps/creator/src/app/api/admin/games/route.ts",
  "apps/store/src/app/manifest.ts",
  "apps/store/src/app/error.tsx",
  "apps/store/src/app/loading.tsx",
  "apps/store/src/app/not-found.tsx",
  "apps/store/src/app/robots.ts",
  "apps/store/src/app/api/health/route.ts",
  "apps/store/src/app/api/ready/route.ts",
  "apps/store/src/lib/readiness.mjs",
  "apps/store/src/app/forgot-password/page.tsx",
  "apps/store/src/app/reset-password/page.tsx",
  "apps/store/src/components/password-recovery.tsx",
  "apps/creator/src/app/manifest.ts",
  "apps/creator/src/app/error.tsx",
  "apps/creator/src/app/loading.tsx",
  "apps/creator/src/app/not-found.tsx",
  "apps/creator/src/app/robots.ts",
  "apps/creator/src/app/api/health/route.ts",
  "apps/creator/src/app/api/ready/route.ts",
  "apps/creator/src/lib/readiness.mjs",
  "apps/creator/src/app/forgot-password/page.tsx",
  "apps/creator/src/app/reset-password/page.tsx",
  "apps/creator/src/components/password-recovery.tsx",
  "supabase/migrations/0001_game_on_core.sql",
  "supabase/migrations/0002_safe_game_resubmission.sql",
  "supabase/migrations/0003_admin_moderation.sql",
  "supabase/migrations/0004_player_reports.sql",
  "supabase/migrations/0005_quarantined_game_build_uploads.sql",
  "supabase/migrations/0006_scanner_worker_leases.sql",
  "supabase/migrations/0007_marketplace_notifications_analytics.sql",
  "supabase/migrations/0008_player_creator_experience.sql",
  "supabase/migrations/0009_marketplace_commerce.sql",
  "apps/store/src/lib/payment-server.ts",
  "apps/store/src/lib/payment-config.mjs",
  "apps/store/src/lib/refund-event.mjs",
  "apps/store/src/lib/body-limit.mjs",
  "apps/store/src/app/api/checkout/route.ts",
  "apps/store/src/app/api/checkout/verify/route.ts",
  "apps/store/src/app/api/paystack/webhook/route.ts",
  "apps/store/src/app/api/orders/route.ts",
  "apps/store/src/app/api/refunds/route.ts",
  "apps/creator/src/app/api/admin/refunds/route.ts",
  "apps/creator/src/components/creator-sales.tsx",
  "apps/creator/src/components/admin-refund-queue.tsx",
  "apps/creator/src/app/admin/refunds/page.tsx",
  "scripts/test-commerce-safety.mjs",
  "apps/creator/src/lib/server-auth.ts",
  "apps/creator/src/app/api/builds/upload-url/route.ts",
  "apps/creator/src/app/api/builds/finalize/route.ts",
  "apps/creator/src/app/api/builds/route.ts",
  "apps/creator/src/app/api/admin/builds/route.ts",
  "apps/creator/src/app/api/internal/build-scan/route.ts",
  "apps/creator/src/components/build-manager.tsx",
  "apps/store/src/app/api/downloads/[gameId]/route.ts",
  "services/build-scanner/worker.mjs",
  "services/build-scanner/compose.yaml",
  "services/build-scanner/Dockerfile",
  "services/build-scanner/README.md",
  "scripts/test-build-scanner.mjs",
  "SCANNER_TEST_RESULTS.md",
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Missing required files:\n" + missing.join("\n"));
  process.exit(1);
}
const creatorEnv = fs.readFileSync(path.join(root, "apps/creator/.env.example"), "utf8");
const storeEnv = fs.readFileSync(path.join(root, "apps/store/.env.example"), "utf8");
if (!creatorEnv.includes("SUPABASE_SERVICE_ROLE_KEY=") || !creatorEnv.includes("GAMEON_ADMIN_USER_IDS=")) throw new Error("Creator server environment template is incomplete.");
if (storeEnv.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY") || storeEnv.includes("GAMEON_ADMIN_USER_IDS")) throw new Error("The Store must not expose service-role secrets publicly or carry Creator admin allowlists.");
const route = fs.readFileSync(path.join(root, "apps/creator/src/app/api/admin/games/route.ts"), "utf8");
const storeCode = fs.readFileSync(path.join(root, "apps/store/src/components/store-app.tsx"), "utf8");
if (!route.includes("auth.getUser(token)") || !route.includes("GAMEON_ADMIN_USER_IDS") || !route.includes("SUPABASE_SERVICE_ROLE_KEY")) throw new Error("Admin API is missing server-side identity and allowlist checks.");
const storeDownload = fs.readFileSync(path.join(root, "apps/store/src/app/api/downloads/[gameId]/route.ts"), "utf8");
if (!storeEnv.includes("SUPABASE_SERVICE_ROLE_KEY=") || !storeDownload.includes("process.env.SUPABASE_SERVICE_ROLE_KEY") || storeDownload.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")) throw new Error("The Store signed-download route must use a server-only service-role secret.");
if (route.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")) throw new Error("Service role key must never be public.");
if (!storeCode.includes('from("reviews")') || !storeCode.includes('from("reviews").insert')) throw new Error("Store review flow is missing.");
if (!storeCode.includes('from("game_reports").insert') || !route.includes('from("game_reports")')) throw new Error("Player reporting flow is missing from Store or admin API.");
for (const app of ["store", "creator"]) { const recovery = fs.readFileSync(path.join(root, `apps/${app}/src/components/password-recovery.tsx`), "utf8"); if (!recovery.includes("resetPasswordForEmail") || !recovery.includes("updateUser({ password })")) throw new Error(`${app} password recovery flow is incomplete.`); }
const adminUi = fs.readFileSync(path.join(root, "apps/creator/src/components/admin-review-app.tsx"), "utf8");
if (!adminUi.includes("Player safety reports") || !adminUi.includes('act("report"')) throw new Error("Admin report triage UI is missing.");
const downloadRoute = fs.readFileSync(path.join(root, "apps/store/src/app/api/downloads/[gameId]/route.ts"), "utf8");
const buildRoute = fs.readFileSync(path.join(root, "apps/creator/src/app/api/builds/upload-url/route.ts"), "utf8");
const finalizeRoute = fs.readFileSync(path.join(root, "apps/creator/src/app/api/builds/finalize/route.ts"), "utf8");
const scannerRoute = fs.readFileSync(path.join(root, "apps/creator/src/app/api/internal/build-scan/route.ts"), "utf8");
const adminBuildRoute = fs.readFileSync(path.join(root, "apps/creator/src/app/api/admin/builds/route.ts"), "utf8");
const buildManager = fs.readFileSync(path.join(root, "apps/creator/src/components/build-manager.tsx"), "utf8");
const buildMigration = fs.readFileSync(path.join(root, "supabase/migrations/0005_quarantined_game_build_uploads.sql"), "utf8");
for (const [name, source, needles] of [
  ["signed download route", downloadRoute, ["auth.getUser(token)", "user_library", 'game.status !== "published"', 'eq("scan_status", "clean")', 'eq("release_status", "approved")', "createSignedUrl"]],
  ["upload URL route", buildRoute, ["getDeveloperContext", "verification_status", "createSignedUploadUrl", "game-build-quarantine", "fileSize > maxBytes", "BUCKET_MAX_BYTES"]],
  ["upload finalizer", finalizeRoute, ["storage.from(BUCKET).info", "actualSize !== Number(build.file_size_bytes)", "upload_status: \"uploaded\""]],
  ["scanner callback", scannerRoute, ["timingSafeEqual", "GAMEON_SCANNER_WEBHOOK_SECRET", "sha256_hex", "scan_worker_id", "workerId"]],
  ["admin build review", adminBuildRoute, ["GAMEON_ADMIN_USER_IDS", "build.scan_status !== \"clean\"", "release_status"]],
  ["build manager", buildManager, ["uploadToSignedUrl", "/api/builds/upload-url", "/api/builds/finalize", "private quarantine"]],
  ["build migration", buildMigration, ["public = false", "game-build-quarantine", "awaiting_upload", "sha256_hex drop not null"]],
]) for (const needle of needles) if (!source.includes(needle)) throw new Error(`${name} missing required control: ${needle}`);
const marketplaceMigration = fs.readFileSync(path.join(root, "supabase/migrations/0007_marketplace_notifications_analytics.sql"), "utf8");
for (const needle of ["public.notifications", "notifications_read_own", "public.download_events", "notify_studio_when_game_published", "notify_players_when_build_approved", "No client policies"]) if (!marketplaceMigration.includes(needle)) throw new Error(`Marketplace migration missing expected control: ${needle}`);
if (!downloadRoute.includes('from("download_events").insert') || !downloadRoute.includes("sha256: build.sha256_hex")) throw new Error("Download analytics or build-integrity metadata is missing.");
const scannerWorker = fs.readFileSync(path.join(root, "services/build-scanner/worker.mjs"), "utf8");
const scannerMigration = fs.readFileSync(path.join(root, "supabase/migrations/0006_scanner_worker_leases.sql"), "utf8");
for (const needle of ["zINSTREAM\\0", "writeUInt32BE", "sha256", "scan_worker_id", "game-build-quarantine", "https:"]) if (!scannerWorker.includes(needle)) throw new Error(`Scanner worker missing required behavior: ${needle}`);
for (const needle of ["scan_started_at", "scan_worker_id", "scan_attempts"]) if (!scannerMigration.includes(needle)) throw new Error(`Scanner lease migration missing ${needle}.`);
if (!scannerWorker.includes("clamav") || !scannerWorker.includes("createHash('sha256')")) throw new Error("Scanner worker is missing ClamAV or SHA-256 support.");
const retryRoute = fs.readFileSync(path.join(root, "apps/creator/src/app/api/admin/builds/route.ts"), "utf8");
if (!retryRoute.includes("retry_scan") || !retryRoute.includes('eq("scan_status", "failed")')) throw new Error("Admin failed-scan retry action is missing.");
const gameModerationRoute = fs.readFileSync(path.join(root, "apps/creator/src/app/api/admin/games/route.ts"), "utf8");
if (!gameModerationRoute.includes('eq("scan_status", "clean")') || !gameModerationRoute.includes('eq("release_status", "approved")')) throw new Error("Game listing publication is not gated on a clean release-approved build.");

const playerStore = fs.readFileSync(path.join(root, "apps/store/src/components/store-app.tsx"), "utf8");
const creatorInsights = fs.readFileSync(path.join(root, "apps/creator/src/components/creator-insights.tsx"), "utf8");
const experienceMigration = fs.readFileSync(path.join(root, "supabase/migrations/0008_player_creator_experience.sql"), "utf8");
for (const [name, source, needles] of [
  ["player account centre", playerStore, ['"notifications"', '"profile"', 'from("notifications")', 'from("profiles")', 'get_game_release_history', 'markAllNotificationsRead']],
  ["creator insight centre", creatorInsights, ['CreatorInbox', 'CreatorAnalytics', 'get_creator_game_analytics', 'download_link_issues', 'Mark all read']],
  ["experience migration", experienceMigration, ['get_creator_game_analytics', 'get_game_release_history', 'security definer', 'owner_user_id = caller', "scan_status = 'clean'", "release_status = 'approved'"]],
]) for (const needle of needles) if (!source.includes(needle)) throw new Error(`${name} missing required behavior: ${needle}`);

const reportMigration = fs.readFileSync(path.join(root, "supabase/migrations/0004_player_reports.sql"), "utf8");
for (const needle of ["game_reports_insert_own_published", "game_reports_read_own", "protect_game_report_metadata", "game_reports_queue_idx"]) if (!reportMigration.includes(needle)) throw new Error(`Report migration missing expected safety control: ${needle}`);
const migration = fs.readFileSync(path.join(root, "supabase/migrations/0003_admin_moderation.sql"), "utf8");
for (const needle of ["games_owner_update_unlocked", "protect_moderation_metadata", "reviews_moderation_queue_idx", "new.moderation_status := 'pending'", "reviews_insert_own_entitled_not_own_game"]) if (!migration.includes(needle)) throw new Error(`Migration missing expected safety control: ${needle}`);
for (const app of ["store", "creator"]) {
  const config = fs.readFileSync(path.join(root, `apps/${app}/next.config.ts`), "utf8");
  for (const header of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options"]) if (!config.includes(header)) throw new Error(`${app} security headers are missing ${header}.`);
}
const commerceMigration = fs.readFileSync(path.join(root, "supabase/migrations/0009_marketplace_commerce.sql"), "utf8");
const checkoutRoute = fs.readFileSync(path.join(root, "apps/store/src/app/api/checkout/route.ts"), "utf8");
const paymentHelper = fs.readFileSync(path.join(root, "apps/store/src/lib/payment-server.ts"), "utf8");
const paymentWebhook = fs.readFileSync(path.join(root, "apps/store/src/app/api/paystack/webhook/route.ts"), "utf8");
const paymentConfig = fs.readFileSync(path.join(root, "apps/store/src/lib/payment-config.mjs"), "utf8");
const refundEffects = fs.readFileSync(path.join(root, "apps/store/src/lib/refund-event.mjs"), "utf8");
const bodyLimit = fs.readFileSync(path.join(root, "apps/store/src/lib/body-limit.mjs"), "utf8");
const refundAdmin = fs.readFileSync(path.join(root, "apps/creator/src/app/api/admin/refunds/route.ts"), "utf8");
for (const [name, source, needles] of [
  ["commerce migration", commerceMigration, ["public.marketplace_orders", "public.refund_requests", "complete_marketplace_order", "to service_role", "get_creator_sales_summary", "marketplace_orders_read_own"]],
  ["checkout route", checkoutRoute, ["paystackConfiguration", "transaction/initialize", "verification_status", "game.price_minor", "currency !== \"NGN\""]],
  ["payment verification", paymentHelper, ["paystackConfiguration", "timingSafeEqual", "createHmac(\"sha512\"", "transaction/verify/", "payment.amount", "payment.currency", "complete_marketplace_order"]],
  ["payment webhook", paymentWebhook, ["x-paystack-signature", "charge.success", "refund.processed", "refundEventEffects", "content-length", "verifyPaystackAndFulfil"]],
  ["payment configuration", paymentConfig, ["GAMEON_PAYMENTS_ENABLED", "sk_test_", "sk_live_", "GAMEON_LIVE_PAYMENTS_APPROVED"]],
  ["refund event monotonicity", refundEffects, ["updatedRefund && updatedRefund.id", "markOrderRefunded", "restorePaidOrder", "removeLibraryEntitlement"]],
  ["webhook streaming body limit", bodyLimit, ["getReader()", "value.byteLength", "reader.cancel", "maximumBytes"]],
  ["admin refunds", refundAdmin, ["GAMEON_ADMIN_USER_IDS", "auth.getUser(token)", "api.paystack.co/refund"]],
]) for (const needle of needles) if (!source.includes(needle)) throw new Error(`${name} missing payment/security control: ${needle}`);
const storeEnvCommerce = fs.readFileSync(path.join(root, "apps/store/.env.example"), "utf8");
const creatorEnvCommerce = fs.readFileSync(path.join(root, "apps/creator/.env.example"), "utf8");
if (!storeEnvCommerce.includes("PAYSTACK_SECRET_KEY=") || !creatorEnvCommerce.includes("PAYSTACK_SECRET_KEY=") || storeEnvCommerce.includes("NEXT_PUBLIC_PAYSTACK_SECRET_KEY") || creatorEnvCommerce.includes("NEXT_PUBLIC_PAYSTACK_SECRET_KEY")) throw new Error("Paystack secret must be configured server-side only in both deployments.");

const rootPackage = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (!Array.isArray(rootPackage.workspaces) || !rootPackage.workspaces.includes("apps/store") || !rootPackage.workspaces.includes("apps/creator")) {
  throw new Error("Both applications must be declared as separate npm workspaces.");
}
for (const workflowFile of [".github/workflows/ci.yml", "supabase/config.toml", "supabase/tests/marketplace_security.test.sql", "SECURITY.md", "scripts/test-readiness.mjs"]) {
  if (!fs.existsSync(path.join(root, workflowFile))) throw new Error(`Release infrastructure file is missing: ${workflowFile}`);
}

for (const app of ["store", "creator"]) {
  const health = fs.readFileSync(path.join(root, `apps/${app}/src/app/api/health/route.ts`), "utf8");
  const ready = fs.readFileSync(path.join(root, `apps/${app}/src/app/api/ready/route.ts`), "utf8");
  const readiness = fs.readFileSync(path.join(root, `apps/${app}/src/lib/readiness.mjs`), "utf8");
  if (!health.includes('status: "ok"') || !health.includes('Cache-Control')) throw new Error(`${app} liveness route is incomplete.`);
  for (const needle of ["checkReadiness", 'status: result.ready ? "ready" : "not_ready"', 'status: result.ready ? 200 : 503', 'Cache-Control']) if (!ready.includes(needle)) throw new Error(`${app} readiness route missing ${needle}.`);
  for (const needle of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", 'method: "HEAD"', "AbortSignal.timeout", "checks.database = response.ok"]) if (!readiness.includes(needle)) throw new Error(`${app} readiness probe missing ${needle}.`);
  if (app === "creator" && (!ready.includes("GAMEON_ADMIN_USER_IDS") || !ready.includes("GAMEON_SCANNER_WEBHOOK_SECRET"))) throw new Error("Creator readiness must require its admin allowlist and scanner secret.");
}

for (const app of ["store", "creator"]) {
  const eas = JSON.parse(fs.readFileSync(path.join(root, `mobile/${app}/eas.json`), "utf8"));
  if (eas.build?.preview?.distribution !== "internal" || eas.build?.preview?.android?.buildType !== "apk") {
    throw new Error(`${app} must retain an internal APK profile for device testing.`);
  }
  if (eas.build?.["production-apk"]?.extends !== "production" || eas.build?.["production-apk"]?.distribution !== "internal" || eas.build?.["production-apk"]?.android?.buildType !== "apk") {
    throw new Error(`${app} production-apk profile must create an internal Release APK.`);
  }
  if (eas.build?.production?.distribution !== "store" || eas.build?.production?.android?.buildType !== "app-bundle") {
    throw new Error(`${app} production profile must create a Google Play AAB.`);
  }
}
const nativeCreator = fs.readFileSync(path.join(root, "mobile/creator/App.tsx"), "utf8");
const resubmissionMigration = fs.readFileSync(path.join(root, "supabase/migrations/0002_safe_game_resubmission.sql"), "utf8");
for (const needle of ["function beginEditGame", "function cancelGameEdit", 'rpc("resubmit_game"', '"draft", "submitted", "rejected"', "EDIT & RESUBMIT", "Game ON controls all review decisions", 'rejection_reason: null']) {
  if (!nativeCreator.includes(needle)) throw new Error(`Creator mobile listing editor missing required guard or behavior: ${needle}`);
}
for (const needle of ["public.resubmit_game(p_game_id uuid)", "old.status = 'rejected'", "new.status = 'submitted'", "owner_user_id = auth.uid()"]) {
  if (!resubmissionMigration.includes(needle)) throw new Error(`Safe rejected-listing resubmission migration missing: ${needle}`);
}
for (const needle of ["function getOwnedCoverObjectPath(", "cover-${uniqueSuffix}", "getPublicUrl(replacementCoverPath)", "REPLACE COVER ART", "DISCARD NEW IMAGE"]) {
  if (!nativeCreator.includes(needle)) throw new Error(`Creator mobile cover replacement missing required behavior: ${needle}`);
}
const replacementUploadAt = nativeCreator.indexOf(".upload(replacementCoverPath", nativeCreator.indexOf("async function submitGame()"));
const replacementUpdateAt = nativeCreator.indexOf('.from("games")', replacementUploadAt);
const previousCoverRemovalAt = nativeCreator.indexOf(".remove([previousCoverPath])", replacementUpdateAt);
if (replacementUploadAt < 0 || replacementUpdateAt <= replacementUploadAt || previousCoverRemovalAt <= replacementUpdateAt) {
  throw new Error("Cover replacement must upload first, update the game record second, and remove the previous object last.");
}
console.log(`Source verification passed: ${required.length} required files plus reporting, security, build scanning, payment verification, refund controls and deployment probes.`);
