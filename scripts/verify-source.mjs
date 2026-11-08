import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "apps/store/src/app/page.tsx",
  "apps/store/src/components/store-app.tsx",
  "apps/creator/src/components/creator-insights.tsx",
  "apps/creator/src/components/creator-app.tsx",
  "apps/creator/src/components/studio-onboarding-wizard.tsx",
  "apps/creator/src/lib/pending-studio-setup.ts",
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
  "supabase/migrations/0012_game_fit_platform_details.sql",
  "supabase/migrations/0014_creator_game_drafts.sql",
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
  "RELEASE_READINESS.md",
  "deploy/ANDROID-RELEASE-RUNBOOK.md",
  ".github/workflows/android-release.yml",
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Missing required files:\n" + missing.join("\n"));
  process.exit(1);
}
const creatorOnboardingSource = fs.readFileSync(path.join(root, "apps/creator/src/components/creator-app.tsx"), "utf8");
const studioWizardSource = fs.readFileSync(path.join(root, "apps/creator/src/components/studio-onboarding-wizard.tsx"), "utf8");
const pendingStudioDraftSource = fs.readFileSync(path.join(root, "apps/creator/src/lib/pending-studio-setup.ts"), "utf8");
for (const [name, source, needles] of [
  ["pending Creator setup storage", pendingStudioDraftSource, [
    "window.indexedDB.open",
    "logoBlob",
    "expiresAt",
    "DRAFT_TTL_MS = 72 * 60 * 60 * 1000",
    "savePendingStudioSetupDraft",
    "loadPendingStudioSetupDraft",
    "clearPendingStudioSetupDraft",
    "function isStoredDraft(value: unknown)",
    "record.expiresAt <= Date.now()",
  ]],
  ["Creator company wizard recovery", studioWizardSource, [
    "initialStep?: number",
    "onDraftChange?:",
    "await onContinueToAccount(data)",
    "draftSaveTimer",
    "if (saved === false)",
    "PENDING_STUDIO_SETUP_TTL_HOURS",
  ]],
  ["Creator company-first auth recovery", creatorOnboardingSource, [
    "if (!user && !showAccountCreation)",
    "if (!user && showAccountCreation)",
    "loadPendingStudioSetupDraft()",
    "savePendingStudioSetupDraft(data, step, \"company\")",
    "savePendingStudioSetupDraft(data, 5, \"account\")",
    "finishConfirmedAccountSetup",
    '.eq("owner_user_id", setupUser.id)',
    'from("developer_studio_contacts").upsert',
  ]],
]) {
  for (const needle of needles) {
    if (!source.includes(needle)) throw new Error(`${name} is missing required recovery control: ${needle}`);
  }
}
if (creatorOnboardingSource.indexOf("if (!user && !showAccountCreation)") > creatorOnboardingSource.indexOf("if (!user && showAccountCreation)")) {
  throw new Error("First-time Creator visitors must complete company setup before account creation.");
}
if (pendingStudioDraftSource.includes("password")) {
  throw new Error("Pending company setup storage must never persist account passwords.");
}
if (creatorOnboardingSource.indexOf("finishConfirmedAccountSetup") < 0 || !creatorOnboardingSource.includes("return false;")) {
  throw new Error("Creator account confirmation must be able to resume failed setup without discarding the draft.");
}

const creatorEnv = fs.readFileSync(path.join(root, "apps/creator/.env.example"), "utf8");
const storeEnv = fs.readFileSync(path.join(root, "apps/store/.env.example"), "utf8");
if (!creatorEnv.includes("SUPABASE_SECRET_KEY=") || !creatorEnv.includes("GAMEON_ADMIN_USER_IDS=")) throw new Error("Creator server environment template is incomplete.");
if (storeEnv.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY") || storeEnv.includes("GAMEON_ADMIN_USER_IDS")) throw new Error("The Store must not expose service-role secrets publicly or carry Creator admin allowlists.");
const route = fs.readFileSync(path.join(root, "apps/creator/src/app/api/admin/games/route.ts"), "utf8");
const storeCode = fs.readFileSync(path.join(root, "apps/store/src/components/store-app.tsx"), "utf8");
if (!route.includes("auth.getUser(token)") || !route.includes("GAMEON_ADMIN_USER_IDS") || !route.includes("SUPABASE_SERVICE_ROLE_KEY")) throw new Error("Admin API is missing server-side identity and allowlist checks.");
const storeDownload = fs.readFileSync(path.join(root, "apps/store/src/app/api/downloads/[gameId]/route.ts"), "utf8");
if (!storeEnv.includes("SUPABASE_SECRET_KEY=") || !storeDownload.includes("process.env.SUPABASE_SECRET_KEY") || storeDownload.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")) throw new Error("The Store signed-download route must use a server-only service-role secret.");
if (route.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")) throw new Error("Service role key must never be public.");
if (!storeCode.includes('from("reviews")') || !storeCode.includes('from("reviews").insert')) throw new Error("Store review flow is missing.");
if (!storeCode.includes('from("game_reports").insert') || !route.includes('from("game_reports")')) throw new Error("Player reporting flow is missing from Store or admin API.");
for (const app of ["store", "creator"]) { const recovery = fs.readFileSync(path.join(root, `apps/${app}/src/components/password-recovery.tsx`), "utf8"); if (!recovery.includes("resetPasswordForEmail") || !recovery.includes("updateUser({ password })")) throw new Error(`${app} password recovery flow is incomplete.`); }
const adminUi = fs.readFileSync(path.join(root, "apps/creator/src/components/admin-review-app.tsx"), "utf8");
if (!adminUi.includes("Player safety reports") || !adminUi.includes('act("report"')) throw new Error("Admin report triage UI is missing.");
const gameFitAdminRoute = fs.readFileSync(path.join(root, "apps/creator/src/app/api/admin/games/route.ts"), "utf8");
for (const marker of ['entityType === "game_fit"', "official_access_url_verified_at", "download_size_verified_at", "internet_requirement_verified_at", "minimum_requirements_verified_at", "audit_events"]) {
  if (!gameFitAdminRoute.includes(marker)) throw new Error(`Admin GAME FIT verification route is missing: ${marker}`);
}
for (const marker of ["ModerationPlatformDetail", "actGameFit", "Verify fact", "Revoke verification", "game_platform_details"]) {
  if (!adminUi.includes(marker)) throw new Error(`Admin GAME FIT review UI is missing: ${marker}`);
}
const downloadRoute = fs.readFileSync(path.join(root, "apps/store/src/app/api/downloads/[gameId]/route.ts"), "utf8");
const buildRoute = fs.readFileSync(path.join(root, "apps/creator/src/app/api/builds/upload-url/route.ts"), "utf8");
const finalizeRoute = fs.readFileSync(path.join(root, "apps/creator/src/app/api/builds/finalize/route.ts"), "utf8");
const scannerRoute = fs.readFileSync(path.join(root, "apps/creator/src/app/api/internal/build-scan/route.ts"), "utf8");
const adminBuildRoute = fs.readFileSync(path.join(root, "apps/creator/src/app/api/admin/builds/route.ts"), "utf8");
const buildManager = fs.readFileSync(path.join(root, "apps/creator/src/components/build-manager.tsx"), "utf8");
const buildMigration = fs.readFileSync(path.join(root, "supabase/migrations/0005_quarantined_game_build_uploads.sql"), "utf8");
for (const [name, source, needles] of [
  ["signed download route", downloadRoute, ["auth.getUser(token)", "user_library", 'game.status !== "published"', 'eq("scan_status", "clean")', 'eq("release_status", "approved")', "createSignedUrl"]],
  ["upload URL route", buildRoute, ["getDeveloperContext", "GAMEON_SCANNER_ENABLED !== \"true\"", "verification_status", "createSignedUploadUrl", "game-build-quarantine", "fileSize > maxBytes", "BUCKET_MAX_BYTES"]],
  ["upload finalizer", finalizeRoute, ["storage.from(BUCKET).info", "actualSize !== Number(build.file_size_bytes)", "upload_status: \"uploaded\""]],
  ["scanner callback", scannerRoute, ["timingSafeEqual", "GAMEON_SCANNER_WEBHOOK_SECRET", "sha256_hex", "scan_worker_id", "workerId"]],
  ["admin build review", adminBuildRoute, ["GAMEON_ADMIN_USER_IDS", "build.scan_status !== \"clean\"", "release_status"]],
  ["build manager", buildManager, ["uploadToSignedUrl", "/api/builds/upload-url", "/api/builds/finalize", "private quarantine"]],
  ["build migration", buildMigration, ["public = false", "game-build-quarantine", "awaiting_upload", "sha256_hex drop not null"]],
]) for (const needle of needles) if (!source.includes(needle)) throw new Error(`${name} missing required control: ${needle}`);
const creatorPage = fs.readFileSync(path.join(root, "apps/creator/src/app/page.tsx"), "utf8");
if (!creatorPage.includes("GAMEON_SCANNER_ENABLED") || !creatorPage.includes("scannerEnabled")) throw new Error("Creator page must pass the server-side scanner readiness flag.");
if (!buildManager.includes("scannerEnabled") || !buildManager.includes("!scannerEnabled")) throw new Error("Creator upload UI must stay disabled until scanner readiness is enabled.");
if (!creatorEnv.includes("GAMEON_SCANNER_ENABLED=false")) throw new Error("Creator environment template must default scanner uploads to disabled.");
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
  for (const needle of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SECRET_KEY", 'method: "HEAD"', "AbortSignal.timeout", "checks.database = response.ok"]) if (!readiness.includes(needle)) throw new Error(`${app} readiness probe missing ${needle}.`);
  if (app === "creator" && (!ready.includes("GAMEON_ADMIN_USER_IDS") || !ready.includes("GAMEON_SCANNER_WEBHOOK_SECRET"))) throw new Error("Creator readiness must require its admin allowlist and scanner secret.");
}

const creatorStatusSource = fs.readFileSync(path.join(root, "apps/creator/src/components/creator-app.tsx"), "utf8");
for (const marker of [
  "reviewed_at,rejection_reason",
  "function gameReviewStatus",
  'label: "Submitted"',
  'label: "In review"',
  'label: "Changes requested"',
  'label: "Published"',
  "game.rejection_reason &&",
  'const canEdit = ["draft", "submitted", "rejected"]',
  "Locked during review",
]) {
  if (!creatorStatusSource.includes(marker)) throw new Error(`Creator review status guidance is missing: ${marker}`);
}

for (const marker of [
  "async function saveNewGameDraft(",
  'rpc("create_game_draft"',
  'rpc("submit_game_draft"',
  'name="submissionAction" value="draft"',
  'name="submissionAction" value="submit"',
  'editingGame.status === "draft" ? "Draft submitted for Game ON review."',
  "readGameFitInputs(form, platforms, !saveDraftOnly)",
]) {
  if (!creatorStatusSource.includes(marker)) throw new Error("Creator Save as Draft / Resume Later is missing: " + marker);
}
for (const marker of [
  "async function deleteGameDraft(",
  '.from("games")',
  '.eq("status", "draft")',
  "onDeleteDraft={deleteGameDraft}",
  "game.updated_at && <small>Last saved",
]) {
  if (!creatorStatusSource.includes(marker)) throw new Error("Creator draft management is missing: " + marker);
}
for (const marker of [
  "function getDraftProgress(game: GameRow)",
  '{ id: "drafts", label: "Drafts", icon: "✎" }',
  "const visibleDraftGames = draftGames.filter",
  "section === \"drafts\"",
  "value={draftSearch}",
  "value={draftSort}",
  '<option value="most-complete">Most complete</option>',
  '<option value="least-complete">Least complete</option>',
  "aria-valuenow={progress.percent}",
  "Submission readiness",
  "Ready to submit",
]) {
  if (!creatorStatusSource.includes(marker)) throw new Error("Creator Drafts workspace is missing: " + marker);
}
const creatorFitSource = fs.readFileSync(path.join(root, "apps/creator/src/components/creator-app.tsx"), "utf8");
for (const marker of ["readGameFitInput", "game_platform_details", "officialAccessUrl", "downloadSizeMb", "internetRequirement", "minimum_requirements", "supported_languages", "age_rating"]) {
  if (!creatorFitSource.includes(marker)) throw new Error(`Creator GAME FIT submission is missing: ${marker}`);
}
for (const marker of ["GAME_PLATFORMS", "readGameFitInputs", 'form.getAll("platforms")', 'name="platforms"', "platformDetails.map((detail)", "removedPlatforms"]) {
  if (!creatorFitSource.includes(marker)) throw new Error(`Creator multi-platform submission is missing: ${marker}`);
}
const catalogFitSource = fs.readFileSync(path.join(root, "apps/store/src/lib/catalog.ts"), "utf8");
if (!catalogFitSource.includes("supportedPlatforms.some")) throw new Error("Store GAME FIT facts must be limited to declared supported platforms.");
const storeFitSource = fs.readFileSync(path.join(root, "apps/store/src/components/store-app.tsx"), "utf8");
for (const marker of ["game_platform_details(", "gameHasOfflineSupportForPlatform", "GAME FIT DETAILS", "Developer-provided", "Game ON verified", "Not supplied"]) {
  if (!storeFitSource.includes(marker)) throw new Error(`Store GAME FIT display is missing: ${marker}`);
}

const moderationUiSource = fs.readFileSync(path.join(root, "apps/creator/src/components/admin-review-app.tsx"), "utf8");
for (const marker of [
  "(game.game_platform_details || []).map",
  "detail.platform",
  "actGameFit(game.id, detail.platform, fact.field",
  "GAME FIT ·",
]) {
  if (!moderationUiSource.includes(marker)) throw new Error(`Creator moderation is missing per-platform review support: ${marker}`);
}

const moderationApiSource = fs.readFileSync(path.join(root, "apps/creator/src/app/api/admin/games/route.ts"), "utf8");
for (const marker of [
  "game_platform_details(platform,official_access_url",
  'if (entityType === "game_fit")',
  '["android", "windows", "web"]',
  '.eq("game_id", recordId).eq("platform", platform)',
  "event_data: { platform, field, action }",
]) {
  if (!moderationApiSource.includes(marker)) throw new Error(`Creator moderation API is missing platform-scoped verification: ${marker}`);
}

const catalogMappingSource = fs.readFileSync(path.join(root, "apps/store/src/lib/catalog.ts"), "utf8");
for (const marker of [
  "const supportedPlatforms =",
  "const rawDetails =",
  "supportedPlatforms.some",
  "platformDetails",
]) {
  if (!catalogMappingSource.includes(marker)) throw new Error(`Store catalogue mapping is missing multi-platform detail handling: ${marker}`);
}

const storePlatformUiSource = fs.readFileSync(path.join(root, "apps/store/src/components/store-app.tsx"), "utf8");
for (const marker of [
  "details.map((detail)",
  "detail.platform.toUpperCase()",
  "gameHasOfflineSupportForPlatform",
  "game_platform_details(",
]) {
  if (!storePlatformUiSource.includes(marker)) throw new Error(`Store UI is missing per-platform GAME FIT handling: ${marker}`);
}

const androidReleaseWorkflow = fs.readFileSync(path.join(root, ".github/workflows/android-release.yml"), "utf8");
for (const needle of [
  "workflow_dispatch:",
  "name: game-on-android-release",
  "secrets.EXPO_TOKEN",
  "extra.eas.projectId",
  "npx --yes eas-cli@27.4.1 build",
  "--freeze-credentials",
  "--wait",
]) {
  if (!androidReleaseWorkflow.includes(needle)) throw new Error(`Protected Android release workflow is missing: ${needle}`);
}
if (androidReleaseWorkflow.includes("eas submit") || androidReleaseWorkflow.includes("--auto-submit")) {
  throw new Error("The manual Android release workflow must never submit or publish an app automatically.");
}
if (/permissions:\s*\n\s+contents:\s*write/.test(androidReleaseWorkflow)) {
  throw new Error("The Android release workflow must use read-only repository permissions.");
}
for (const app of ["store", "creator"]) {
  const mobileConfig = JSON.parse(fs.readFileSync(path.join(root, `mobile/${app}/app.json`), "utf8")).expo;
  const expectedPackage = app === "store" ? "com.gameon.store" : "com.gameon.creator";
  if (mobileConfig.android?.package !== expectedPackage || mobileConfig.ios?.bundleIdentifier !== expectedPackage) {
    throw new Error(`${app} must use its own matching Android and iOS application ID (${expectedPackage}).`);
  }
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
  if (eas.build?.preview?.environment !== "preview" || eas.build?.["production-apk"]?.environment !== "production" || eas.build?.production?.environment !== "production") {
    throw new Error(`${app} EAS profiles must explicitly select preview/production environments.`);
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
const mobileNavigationSource = fs.readFileSync(path.join(root, "apps/creator/src/components/creator-app.tsx"), "utf8");
const mobileNavigationStyles = fs.readFileSync(path.join(root, "apps/creator/src/app/globals.css"), "utf8");
for (const needle of [
  'const [mobileNavOpen, setMobileNavOpen] = useState(false);',
  'aria-controls="creator-sidebar"',
  'aria-expanded={mobileNavOpen}',
  'className="creator-sidebar-backdrop"',
  'aria-current={section === item.id ? "page" : undefined}',
  'event.key === "Escape"',
]) {
  if (!mobileNavigationSource.includes(needle)) {
    throw new Error("Creator mobile navigation is missing an accessibility or dismissal control: " + needle);
  }
}
if (!mobileNavigationStyles.includes(".creator-sidebar.mobile-open")
  || !mobileNavigationStyles.includes(".creator-sidebar-backdrop")
  || !mobileNavigationStyles.includes("@media (max-width: 700px)")) {
  throw new Error("Creator mobile navigation drawer styles are incomplete.");
}


const creatorOverviewSource = fs.readFileSync(path.join(root, "apps/creator/src/components/creator-app.tsx"), "utf8");
const creatorUiStyles = fs.readFileSync(path.join(root, "apps/creator/src/app/globals.css"), "utf8");
for (const needle of [
  "function CreatorOverview(",
  'needsAttention = draft + rejected',
  'const studioVerified = verificationStatus === "verified"',
  "Uploads remain closed until the private malware-scanning service is deployed and tested.",
  "A link being issued does not prove a completed download, installation, or sale.",
  "aria-label=\"Studio verification status\"",
  "Review feedback",
  "What happens next?",
]) {
  if (!creatorOverviewSource.includes(needle)) {
    throw new Error("Creator overview is missing a required status, trust or navigation feature: " + needle);
  }
}
for (const selector of [
  ".creator-overview",
  ".overview-hero",
  ".overview-stats",
  ".overview-main-grid",
  ".overview-journey-step",
  ".overview-quick-grid",
  "@media (max-width: 390px)",
]) {
  if (!creatorUiStyles.includes(selector)) {
    throw new Error("Creator visual system is missing responsive UI styling: " + selector);
  }
}
if (creatorOverviewSource.includes("total downloads") || creatorOverviewSource.includes("installs")) {
  throw new Error("Creator overview must not mislabel issued download links as completed downloads or installs.");
}


const creatorSubmissionSource = fs.readFileSync(path.join(root, "apps/creator/src/components/creator-app.tsx"), "utf8");
const creatorSubmissionStyles = fs.readFileSync(path.join(root, "apps/creator/src/app/globals.css"), "utf8");
const submitSectionStart = creatorSubmissionSource.indexOf('{section === "submit" &&');
const submitSectionEnd = creatorSubmissionSource.indexOf('{section === "edit" &&', submitSectionStart);
if (submitSectionStart < 0 || submitSectionEnd <= submitSectionStart) {
  throw new Error("Creator game submission screen is missing or its section boundaries are invalid.");
}
const submitSection = creatorSubmissionSource.slice(submitSectionStart, submitSectionEnd);
for (const needle of [
  'id="listing-section-identity"',
  'id="listing-section-platforms"',
  'id="listing-section-player-info"',
  'aria-label="Game listing form sections"',
  "Complete checklist to submit",
  "listing-submit-readiness-hint",
  "Listing and game build are separate",
  "You can follow the status and read any requested changes in My games.",
]) {
  if (!submitSection.includes(needle)) {
    throw new Error("Creator game submission UI is missing a required section, progress cue or review explanation: " + needle);
  }
}
if (submitSection.includes("STEP 1 OF 2")) {
  throw new Error("Creator submission UI must not show the old inaccurate two-step label.");
}
for (const needle of [
  "const readiness = getListingFormReadiness(formElement);",
  "if (!readiness.ready)",
  'disabled={busy || !formReadiness.ready}',
  "Complete the required listing checks before submitting.",
]) {
  if (!creatorSubmissionSource.includes(needle)) {
    throw new Error("Creator submission handler is missing readiness enforcement: " + needle);
  }
}
for (const selector of [
  ".listing-form-layout",
  ".listing-form-nav",
  ".listing-form-section",
  ".listing-form-aside-sticky",
  ".listing-platform-fit-card[hidden]",
  "@media (max-width: 700px)",
]) {
  if (!creatorSubmissionStyles.includes(selector)) {
    throw new Error("Creator submission form is missing responsive layout styling: " + selector);
  }
}


const creatorSubmitHandlerStart = creatorSubmissionSource.indexOf("async function submitGame");
const creatorSubmitHandlerEnd = creatorSubmissionSource.indexOf("async function saveGameEdits", creatorSubmitHandlerStart);
const creatorSubmitHandler = creatorSubmissionSource.slice(creatorSubmitHandlerStart, creatorSubmitHandlerEnd);
const fitValidationIndex = creatorSubmitHandler.indexOf("readGameFitInputs(form, platforms)");
const readinessValidationIndex = creatorSubmitHandler.indexOf("getListingFormReadiness(formElement)");
if (creatorSubmitHandlerStart < 0 || creatorSubmitHandlerEnd <= creatorSubmitHandlerStart
  || fitValidationIndex < 0 || readinessValidationIndex <= fitValidationIndex
  || !creatorSubmitHandler.includes("if (fitInput.error || !fitInput.platformDetails.length)")) {
  throw new Error("Creator submission must show specific GAME FIT errors before applying the overall readiness gate.");
}


const creatorGamesSource = fs.readFileSync(path.join(root, "apps/creator/src/components/creator-app.tsx"), "utf8");
const creatorGamesStyles = fs.readFileSync(path.join(root, "apps/creator/src/app/globals.css"), "utf8");
const gamesSectionStart = creatorGamesSource.indexOf('{section === "games" &&');
const gamesSectionEnd = creatorGamesSource.indexOf('{section === "submit" &&', gamesSectionStart);
if (gamesSectionStart < 0 || gamesSectionEnd <= gamesSectionStart) {
  throw new Error("Creator My games screen is missing or its section boundaries are invalid.");
}
const gamesSection = creatorGamesSource.slice(gamesSectionStart, gamesSectionEnd);
for (const needle of [
  "<CreatorGamesScreen",
  "function CreatorGamesScreen(",
  "aria-label=\"Filter games by status\"",
  'aria-label="Search game listings"',
  "aria-pressed={filter === item.id}",
  'game.status === "submitted" || game.status === "in_review"',
  "game.rejection_reason || \"\"",
  "<GameTable games={visibleGames}",
  "Clear filters",
]) {
  if (!creatorGamesSource.includes(needle)) {
    throw new Error("Creator My games workspace is missing a search, filter or status handling feature: " + needle);
  }
}
if (!gamesSection.includes("<CreatorGamesScreen")) {
  throw new Error("My games navigation must render the new catalogue workspace.");
}
for (const selector of [
  ".games-filter-grid",
  ".games-filter-card.active",
  ".games-management-panel",
  ".games-status-guide",
  ".games-empty",
  "@media (max-width: 700px)",
]) {
  if (!creatorGamesStyles.includes(selector)) {
    throw new Error("Creator My games workspace is missing responsive styling: " + selector);
  }
}


const creatorEditSource = fs.readFileSync(path.join(root, "apps/creator/src/components/creator-app.tsx"), "utf8");
const creatorEditStyles = fs.readFileSync(path.join(root, "apps/creator/src/app/globals.css"), "utf8");
const editSectionStart = creatorEditSource.indexOf('{section === "edit" &&');
const editSectionEnd = creatorEditSource.indexOf('{section === "builds" &&', editSectionStart);
if (editSectionStart < 0 || editSectionEnd <= editSectionStart) {
  throw new Error("Creator edit listing screen is missing or its section boundaries are invalid.");
}
const editSection = creatorEditSource.slice(editSectionStart, editSectionEnd);
for (const needle of [
  'id="edit-section-identity"',
  'id="edit-section-platforms"',
  'id="edit-section-player-info"',
  'aria-label="Edit listing form sections"',
  'aria-label="Game ON reviewer feedback"',
  "editingGame.rejection_reason",
  'defaultChecked={Boolean(editingGame.contains_ads)}',
  'defaultChecked={Boolean(editingGame.has_in_app_purchases)}',
  'editingGame.status === "rejected" && !formReadiness.ready',
  "listing-submit-readiness-hint",
]) {
  if (!editSection.includes(needle)) {
    throw new Error("Creator edit listing UI is missing review feedback, player disclosure preservation or readiness controls: " + needle);
  }
}
const editHandlerStart = creatorEditSource.indexOf("async function saveGameEdits");
const editHandlerEnd = creatorEditSource.indexOf("async function ", editHandlerStart + 10);
const editHandler = creatorEditSource.slice(editHandlerStart, editHandlerEnd);
const editFitValidationIndex = editHandler.indexOf("readGameFitInputs(form, platforms, !saveDraftOnly)");
const editReadinessIndex = editHandler.indexOf("getListingFormReadiness(formElement)");
if (editHandlerStart < 0 || editHandlerEnd <= editHandlerStart
  || editFitValidationIndex < 0 || editReadinessIndex <= editFitValidationIndex
  || !editHandler.includes("if (!saveDraftOnly && !readiness.ready)")
  || !editHandler.includes('const ads = form.get("ads") === "on"')
  || !editHandler.includes('const iap = form.get("iap") === "on"')
  || !creatorEditSource.includes("contains_ads,has_in_app_purchases")) {
  throw new Error("Creator edit handler must validate GAME FIT before readiness and persist both monetisation disclosures.");
}
for (const selector of [
  ".edit-review-feedback",
  ".edit-draft-note",
  ".edit-listing-safety-note",
  "@media (max-width: 700px)",
]) {
  if (!creatorEditStyles.includes(selector)) {
    throw new Error("Creator edit listing screen is missing its responsive review or draft styling: " + selector);
  }
}

console.log(`Source verification passed: ${required.length} required files plus reporting, security, build scanning, payment verification, refund controls and deployment probes.`);
