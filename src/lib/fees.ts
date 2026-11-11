// Buyer service fee preview — must match supabase/functions/_shared/buyerFee.ts,
// which is what actually computes and charges it. 2% of the price plus 20p,
// worked in minor units so it rounds exactly as the server does.
// Relay's commission on a sale — must match the edge functions
// (create-purchase-checkout, accept-offer, create-custom-order).
export const PLATFORM_FEE_PERCENT = 5;
export const PLATFORM_FEE_CAP_GBP = 150;

export const BUYER_FEE_PERCENT = 2;
export const BUYER_FEE_FIXED_MINOR = 20;

export function buyerServiceFee(price: number): number {
  const minor = Math.round(price * 100);
  return (Math.round((minor * BUYER_FEE_PERCENT) / 100) + BUYER_FEE_FIXED_MINOR) / 100;
}
