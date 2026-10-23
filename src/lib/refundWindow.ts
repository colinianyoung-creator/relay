// A buyer can request a refund at any time while their payment is still being
// held, and for REFUND_WINDOW_DAYS after it's released to the seller. After
// release the seller has the money, so it gets harder to reverse the longer
// it's been. Must match REFUND_WINDOW_DAYS in
// supabase/functions/request-refund/index.ts, which is what enforces it.
export const REFUND_WINDOW_DAYS = 30;

/** When the refund window closes, or null if it isn't running (funds still held, or no release date recorded). */
export function refundWindowEnd(order: {
  transferStatus: 'pending' | 'released' | 'refunded';
  transferReleasedAt: string | null;
}): Date | null {
  if (order.transferStatus !== 'released' || !order.transferReleasedAt) return null;
  const end = new Date(order.transferReleasedAt);
  end.setDate(end.getDate() + REFUND_WINDOW_DAYS);
  return end;
}
