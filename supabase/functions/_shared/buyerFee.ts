// Buyer service fee: 2% of the order price plus a fixed 20 minor units
// (20p), added at checkout on top of the price. Works in minor units so
// the amount charged and the amount stored never drift by a rounding step.
// Keep in sync with src/lib/fees.ts, which previews the same figure in the
// checkout UI before this runs.
const BUYER_FEE_PERCENT = 2;
const BUYER_FEE_FIXED_MINOR = 20;

export function buyerFeeMinor(priceMinor: number): number {
  return Math.round((priceMinor * BUYER_FEE_PERCENT) / 100) + BUYER_FEE_FIXED_MINOR;
}
