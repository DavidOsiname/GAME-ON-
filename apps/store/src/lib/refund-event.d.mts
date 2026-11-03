export type RefundEventEffects = {
  applied: boolean;
  markOrderRefunded: boolean;
  restorePaidOrder: boolean;
  removeLibraryEntitlement: boolean;
};
export function refundEventEffects(updatedRefund: { id?: string } | null | undefined, refundStatus: string): RefundEventEffects;
