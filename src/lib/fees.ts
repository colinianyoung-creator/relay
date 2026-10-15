// Buyer service fee preview — must match supabase/functions/_shared/buyerFee.ts,
// which is what actually computes and charges it. 2% of the price plus 20p,
// worked in minor units so it rounds exactly as the server does.
export const BUYER_FEE_PERCENT = 2;
export const BUYER_FEE_FIXED_MINOR = 20;

export function buyerServiceFee(price: number): number {
  const minor = Math.round(price * 100);
  return (Math.round((minor * BUYER_FEE_PERCENT) / 100) + BUYER_FEE_FIXED_MINOR) / 100;
}
