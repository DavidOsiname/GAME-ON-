/**
 * Computes side effects for a provider refund event only after the database
 * successfully moved the refund row out of an eligible state. This makes old,
 * duplicated and out-of-order provider events harmless.
 */
export function refundEventEffects(updatedRefund, refundStatus) {
  const applied = Boolean(updatedRefund && updatedRefund.id);
  return {
    applied,
    markOrderRefunded: applied && refundStatus === "processed",
    restorePaidOrder: applied && refundStatus === "failed",
    removeLibraryEntitlement: applied && refundStatus === "processed",
  };
}
