import type { FitProfile, Listing } from '@/types';

// Tolerances are deliberately generous: a seller's seat measurement and a
// buyer's self-reported height/weight are both estimates, not lab figures,
// and a stated min/max "suits" range is a recommendation, not an engineered
// boundary. The one place we don't add leeway is a wheelchair's rated
// weight CAPACITY — that's a real mechanical limit, not a preference, so it
// stays a hard cutoff below.
const SEAT_WIDTH_TOLERANCE_CM = 4;
const SEAT_DEPTH_TOLERANCE_CM = 5;
const HEIGHT_RANGE_LEEWAY_CM = 5;
const WEIGHT_RANGE_LEEWAY_KG = 3;

/**
 * Whether a listing is plausibly a fit for the given profile, based on
 * whatever numeric fields both sides have filled in. Missing data on either
 * side is treated as "no opinion" rather than a mismatch — a seller who
 * didn't specify a weight capacity shouldn't be excluded just because the
 * buyer filled in their weight.
 */
export function isLikelyFit(listing: Listing, profile: FitProfile): boolean {
  if (profile.seatWidthCm && listing.seatWidthCm) {
    if (Math.abs(listing.seatWidthCm - profile.seatWidthCm) > SEAT_WIDTH_TOLERANCE_CM) return false;
  }
  if (profile.seatDepthCm && listing.seatDepthCm) {
    if (Math.abs(listing.seatDepthCm - profile.seatDepthCm) > SEAT_DEPTH_TOLERANCE_CM) return false;
  }
  if (profile.weightKg && listing.weightCapacityKg) {
    if (profile.weightKg > listing.weightCapacityKg) return false;
  }
  if (profile.heightCm) {
    if (listing.minUserHeightCm && profile.heightCm < listing.minUserHeightCm - HEIGHT_RANGE_LEEWAY_CM) return false;
    if (listing.maxUserHeightCm && profile.heightCm > listing.maxUserHeightCm + HEIGHT_RANGE_LEEWAY_CM) return false;
  }
  if (profile.weightKg) {
    if (listing.minUserWeightKg && profile.weightKg < listing.minUserWeightKg - WEIGHT_RANGE_LEEWAY_KG) return false;
    if (listing.maxUserWeightKg && profile.weightKg > listing.maxUserWeightKg + WEIGHT_RANGE_LEEWAY_KG) return false;
  }
  return true;
}

/** True only when at least one real numeric comparison was actually made. */
export function hasFitSignal(listing: Listing, profile: FitProfile): boolean {
  return !!(
    (profile.seatWidthCm && listing.seatWidthCm) ||
    (profile.seatDepthCm && listing.seatDepthCm) ||
    (profile.weightKg && (listing.weightCapacityKg || listing.minUserWeightKg || listing.maxUserWeightKg)) ||
    (profile.heightCm && (listing.minUserHeightCm || listing.maxUserHeightCm))
  );
}

export function hasAnyProfileData(profile: FitProfile | null): profile is FitProfile {
  if (!profile) return false;
  return !!(
    profile.heightCm ||
    profile.weightKg ||
    profile.seatWidthCm ||
    profile.seatDepthCm ||
    profile.inseamCm ||
    profile.disabilityNotes ||
    profile.classification
  );
}
