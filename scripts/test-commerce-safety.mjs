import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const checks = [
  ['commerce migration', 'supabase/migrations/0009_marketplace_commerce.sql', [
    'public.marketplace_orders', 'public.refund_requests', 'marketplace_orders_read_own',
    'complete_marketplace_order', 'to service_role', 'get_creator_sales_summary',
    'owner_user_id = caller', 'on conflict (user_id, game_id) do nothing',
    'platform_fee_minor + developer_net_minor = amount_minor', 'marketplace_orders_provider_transaction_uidx',
  ]],
  ['checkout route', 'apps/store/src/app/api/checkout/route.ts', [
    'auth.user.email_confirmed_at', 'game.status !== "published"', 'verification_status',
    'game.monetization_type !== "paid"', 'game.price_minor', 'currency !== "NGN"',
    'paystackConfiguration', 'transaction/initialize', 'platform_fee_minor', 'authorization_url',
  ]],
  ['payment verification helper', 'apps/store/src/lib/payment-server.ts', [
    'paystackConfiguration', 'createHmac("sha512"', 'timingSafeEqual', 'transaction/verify/', 'payment.status !== "success"',
    'payment.amount', 'payment.currency', 'complete_marketplace_order',
  ]],
  ['Paystack webhook', 'apps/store/src/app/api/paystack/webhook/route.ts', [
    'paystackConfiguration', 'content-length', 'readUtf8BodyLimited', 'refundEventEffects', 'x-paystack-signature', 'validatePaystackSignature', 'charge.success', 'refund.processed',
    'refund.needs-attention', 'refundEventEffects', 'content-length', 'verifyPaystackAndFulfil',
  ]],
  ['payment configuration', 'apps/store/src/lib/payment-config.mjs', ['GAMEON_PAYMENTS_ENABLED', 'sk_test_', 'sk_live_', 'GAMEON_LIVE_PAYMENTS_APPROVED']],
  ['streaming webhook body limit', 'apps/store/src/lib/body-limit.mjs', ['getReader()', 'value.byteLength', 'reader.cancel', 'TextDecoder']],
  ['refund-event side effects', 'apps/store/src/lib/refund-event.mjs', ['updatedRefund && updatedRefund.id', 'markOrderRefunded', 'restorePaidOrder', 'removeLibraryEntitlement']],
  ['purchase history API', 'apps/store/src/app/api/orders/route.ts', ['authenticateBearer', 'marketplace_orders', 'user_id']],
  ['player refund API', 'apps/store/src/app/api/refunds/route.ts', ['authenticateBearer', 'order.status !== "paid"', 'refund_requests', 'reason.length < 10']],
  ['build upload finalizer', 'apps/creator/src/app/api/builds/finalize/route.ts', ['upload_status: "failed"', 'storage.from(BUCKET).remove([build.object_path])', '.eq("upload_status", "awaiting_upload").select("id").maybeSingle()', 'if (!finalized)']],
  ['admin refund API', 'apps/creator/src/app/api/admin/refunds/route.ts', [
    'GAMEON_PAYMENTS_ENABLED', 'GAMEON_LIVE_PAYMENTS_APPROVED', 'GAMEON_ADMIN_USER_IDS', 'auth.getUser(token)', 'GAMEON_PAYMENTS_ENABLED', 'GAMEON_LIVE_PAYMENTS_APPROVED', 'order.status !== "paid"',
    'api.paystack.co/refund', 'status: nextStatus', 'marketplace_refund_processing_started',
    'status: "processing"', '.eq("status", "requested").select("id")', 'needs_attention',
  ]],
  ['creator sales screen', 'apps/creator/src/components/creator-sales.tsx', ['get_creator_sales_summary', 'GROSS SALES', 'ESTIMATED DEVELOPER NET', 'Before processor fees']],
  ['creator refund UI', 'apps/creator/src/components/admin-refund-queue.tsx', ['/api/admin/refunds', 'Approve & submit full refund']],
  ['store purchase UI', 'apps/store/src/components/store-app.tsx', ['startCheckout', '/api/checkout', '/api/orders', 'Purchase history', 'Submit refund request', 'Buy now']],
];
let count = 0;
for (const [name, file, needles] of checks) {
  const source = read(file);
  for (const needle of needles) {
    if (!source.includes(needle)) throw new Error(`${name}: missing required security or workflow element: ${needle}`);
    count++;
  }
}

// The finalizer must authenticate ownership before returning even an idempotent
// success response, otherwise another developer can probe a build's upload state.
const finalizer = read('apps/creator/src/app/api/builds/finalize/route.ts');
const ownershipCheck = finalizer.indexOf('if (!studio || studio.owner_user_id !== context.userId)');
const alreadyFinalizedResponse = finalizer.indexOf('if (build.upload_status === "uploaded")');
if (ownershipCheck < 0 || alreadyFinalizedResponse < 0 || ownershipCheck > alreadyFinalizedResponse) {
  throw new Error('Build upload finalizer must verify studio ownership before its already-finalized response.');
}
count++;

const storeEnv = read('apps/store/.env.example');
const creatorEnv = read('apps/creator/.env.example');
if (!storeEnv.includes('PAYSTACK_SECRET_KEY=') || !storeEnv.includes('GAMEON_PAYMENTS_ENABLED=false') || storeEnv.includes('NEXT_PUBLIC_PAYSTACK_SECRET_KEY')) throw new Error('Store Paystack secret must be server-only.');
if (!creatorEnv.includes('PAYSTACK_SECRET_KEY=') || !creatorEnv.includes('GAMEON_PAYMENTS_ENABLED=false') || creatorEnv.includes('NEXT_PUBLIC_PAYSTACK_SECRET_KEY')) throw new Error('Creator Paystack secret must be server-only.');
const pkg = JSON.parse(read('apps/store/package.json'));
if (!pkg.scripts.typecheck || !pkg.scripts.build) throw new Error('Store package must define typecheck and production build scripts.');
console.log(`Commerce safety verification passed: ${count} source controls across ${checks.length} files, including build-finalization ownership ordering, plus server-only provider secret checks.`);
