// Mirrors Browse.tsx's own filter predicate (sport/condition/country/price/
// free-only) line-for-line, so a saved search and the live Browse filters
// never quietly diverge. Deliberately excludes fit-profile/quick-fit
// matching — that's a heavier heuristic against structured spec fields,
// out of scope for v1.
export interface MatchableListing {
  sport: string;
  condition: string;
  country: string;
  ships_internationally: boolean;
  price: number | null;
}

export interface SavedSearch {
  sport: string | null;
  condition: string | null;
  country: string | null;
  min_price: number | null;
  max_price: number | null;
  free_only: boolean;
}

export function listingMatchesSearch(listing: MatchableListing, search: SavedSearch): boolean {
  if (search.sport && listing.sport !== search.sport) return false;
  if (search.condition && listing.condition !== search.condition) return false;
  if (search.country && listing.country !== search.country && !listing.ships_internationally) return false;
  if (search.free_only && listing.price !== null) return false;
  if (search.min_price !== null && (listing.price ?? 0) < search.min_price) return false;
  if (search.max_price !== null && (listing.price ?? 0) > search.max_price) return false;
  return true;
}
