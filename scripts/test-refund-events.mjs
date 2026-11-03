import assert from 'node:assert/strict';
import { refundEventEffects } from '../apps/store/src/lib/refund-event.mjs';

// A provider event that did not advance an eligible refund row must never
// affect order status or revoke/restore the player entitlement.
for (const status of ['processed', 'failed', 'processing']) {
  const stale = refundEventEffects(null, status);
  assert.equal(stale.applied, false);
  assert.equal(stale.markOrderRefunded, false);
  assert.equal(stale.restorePaidOrder, false);
  assert.equal(stale.removeLibraryEntitlement, false);
}

const processed = refundEventEffects({ id: 'refund-1' }, 'processed');
assert.equal(processed.markOrderRefunded, true);
assert.equal(processed.removeLibraryEntitlement, true);
assert.equal(processed.restorePaidOrder, false);

const failed = refundEventEffects({ id: 'refund-2' }, 'failed');
assert.equal(failed.restorePaidOrder, true);
assert.equal(failed.markOrderRefunded, false);
assert.equal(failed.removeLibraryEntitlement, false);

const pending = refundEventEffects({ id: 'refund-3' }, 'processing');
assert.equal(pending.applied, true);
assert.equal(pending.markOrderRefunded, false);
assert.equal(pending.restorePaidOrder, false);
assert.equal(pending.removeLibraryEntitlement, false);

console.log('Refund webhook tests passed: stale/out-of-order events cannot reverse completed refunds or alter entitlements.');
