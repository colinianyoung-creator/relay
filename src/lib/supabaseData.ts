import { supabase } from '@/integrations/supabase/client';
import type { Listing, Currency, FitProfile, WantedPost, FleetBundle, Seller } from '@/types';
import { listingMatchesWanted } from '@/lib/fitMatch';

interface ListingRow {
  id: string;
  seller_id: string;
  title: string;
  sport: string;
  category: string;
  condition: string;
  price: number | null;
  currency: string;
  description: string;
  measurements: { label: string; value: string }[];
  location: string;
  country: string;
  ships_internationally: boolean;
  featured: boolean;
  posted_at: string;
  seat_width_cm: number | null;
  seat_depth_cm: number | null;
  weight_capacity_kg: number | null;
  min_user_height_cm: number | null;
  max_user_height_cm: number | null;
  min_user_weight_kg: number | null;
  max_user_weight_kg: number | null;
  photos: string[] | null;
  fee_status: 'exempt' | 'pending' | 'paid';
  sold_at: string | null;
  bundle_id: string | null;
  sellable_individually: boolean;
  profiles: {
    id: string;
    name: string;
    club: string | null;
    verified: boolean;
    rating: number;
    sales_count: number;
    created_at: string;
    stripe_connect_charges_enabled: boolean;
    avatar_url: string | null;
  } | null;
}

function mapListing(row: ListingRow): Listing {
  const seller = row.profiles;
  return {
    id: row.id,
    title: row.title,
    sport: row.sport as Listing['sport'],
    category: row.category,
    condition: row.condition as Listing['condition'],
    price: row.price,
    currency: row.currency as Currency,
    description: row.description,
    measurements: row.measurements ?? [],
    location: row.location,
    country: row.country,
    shipsInternationally: row.ships_internationally,
    featured: row.featured,
    postedAt: row.posted_at,
    seatWidthCm: row.seat_width_cm ?? undefined,
    seatDepthCm: row.seat_depth_cm ?? undefined,
    weightCapacityKg: row.weight_capacity_kg ?? undefined,
    minUserHeightCm: row.min_user_height_cm ?? undefined,
    maxUserHeightCm: row.max_user_height_cm ?? undefined,
    minUserWeightKg: row.min_user_weight_kg ?? undefined,
    maxUserWeightKg: row.max_user_weight_kg ?? undefined,
    photos: row.photos ?? [],
    feeStatus: row.fee_status,
    soldAt: row.sold_at,
    bundleId: row.bundle_id,
    sellableIndividually: row.sellable_individually,
    seller: {
      id: seller?.id ?? row.seller_id,
      name: seller?.name ?? 'Relay member',
      verified: seller?.verified ?? false,
      club: seller?.club ?? undefined,
      rating: seller?.rating ?? 5,
      salesCount: seller?.sales_count ?? 0,
      memberSince: seller?.created_at ? seller.created_at.slice(0, 4) : '2026',
      payoutsEnabled: seller?.stripe_connect_charges_enabled ?? false,
      avatarUrl: seller?.avatar_url ?? null,
    },
  };
}

// Explicit FK name needed: listings->profiles is ambiguous to PostgREST
// because saved_listings also links the two tables indirectly.
const LISTING_SELECT =
  '*, profiles:profiles!listings_seller_id_fkey(id, name, club, verified, rating, sales_count, created_at, stripe_connect_charges_enabled, avatar_url)';

// Fleet-only items (sellable_individually = false) are deliberately excluded
// here — they're only reachable/purchasable via their fleet's own page, not
// through general browse/search. See fetchListingsBySeller below, which a
// seller uses to see everything they own, fleet-only included.
export async function fetchListings(): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('sellable_individually', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as ListingRow[]).map(mapListing);
}

export async function fetchListing(id: string): Promise<Listing | null> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapListing(data as unknown as ListingRow) : null;
}

export async function fetchListingsBySeller(sellerId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as ListingRow[]).map(mapListing);
}

export interface NewListingInput {
  title: string;
  sport: string;
  category: string;
  condition: string;
  price: number | null;
  currency: Currency;
  description: string;
  measurements: { label: string; value: string }[];
  location: string;
  country: string;
  shipsInternationally: boolean;
  seatWidthCm?: number | null;
  seatDepthCm?: number | null;
  weightCapacityKg?: number | null;
  minUserHeightCm?: number | null;
  maxUserHeightCm?: number | null;
  minUserWeightKg?: number | null;
  maxUserWeightKg?: number | null;
  photos?: string[];
}

export const LISTING_FEE_GBP = 9;

export async function createListing(sellerId: string, input: NewListingInput): Promise<string> {
  // Free/donation listings never owe a fee; anything with a price starts
  // 'pending' and is invisible to everyone but the seller until Checkout
  // completes and the webhook confirms it.
  const feeStatus = input.price === null ? 'exempt' : 'pending';
  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id: sellerId,
      title: input.title,
      sport: input.sport,
      category: input.category,
      condition: input.condition,
      price: input.price,
      currency: input.currency,
      description: input.description,
      measurements: input.measurements,
      location: input.location,
      country: input.country,
      ships_internationally: input.shipsInternationally,
      seat_width_cm: input.seatWidthCm ?? null,
      seat_depth_cm: input.seatDepthCm ?? null,
      weight_capacity_kg: input.weightCapacityKg ?? null,
      min_user_height_cm: input.minUserHeightCm ?? null,
      max_user_height_cm: input.maxUserHeightCm ?? null,
      min_user_weight_kg: input.minUserWeightKg ?? null,
      max_user_weight_kg: input.maxUserWeightKg ?? null,
      photos: input.photos ?? [],
      fee_status: feeStatus,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function createListingCheckout(
  listingId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-listing-checkout', {
    body: { listingId, successUrl, cancelUrl },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.url as string;
}

/** Only ever called on a listing still in 'pending' — abandoning Checkout shouldn't leave a half-published listing behind. */
export async function deletePendingListing(listingId: string): Promise<void> {
  await supabase.from('listings').delete().eq('id', listingId).eq('fee_status', 'pending');
}

// --- Fleet listing (create a whole fleet's listings + the bundle together) ---
// Distinct from createFleetBundle below, which groups listings a seller
// already has up. This creates the listings and the bundle in one step, for
// a seller who's never listed any of it before.

export interface FleetSharedFields {
  title: string;
  description: string;
  sport: string;
  category: string;
  currency: Currency;
  location: string;
  country: string;
  shipsInternationally: boolean;
  photos?: string[];
}

export interface FleetItemInput {
  title: string;
  condition: string;
  price: number;
  sellableIndividually: boolean;
  seatWidthCm?: number | null;
  seatDepthCm?: number | null;
}

export async function createFleetListing(
  sellerId: string,
  shared: FleetSharedFields,
  items: FleetItemInput[],
): Promise<string> {
  const { data: bundle, error: bundleError } = await supabase
    .from('listing_bundles')
    .insert({ seller_id: sellerId, title: shared.title, description: shared.description, status: 'draft' })
    .select('id')
    .single();
  if (bundleError) throw bundleError;

  const { error: listingsError } = await supabase.from('listings').insert(
    items.map((item) => ({
      seller_id: sellerId,
      bundle_id: bundle.id,
      title: item.title,
      sport: shared.sport,
      category: shared.category,
      condition: item.condition,
      price: item.price,
      currency: shared.currency,
      description: shared.description,
      measurements: [],
      location: shared.location,
      country: shared.country,
      ships_internationally: shared.shipsInternationally,
      seat_width_cm: item.seatWidthCm ?? null,
      seat_depth_cm: item.seatDepthCm ?? null,
      photos: shared.photos ?? [],
      fee_status: 'pending',
      sellable_individually: item.sellableIndividually,
    })),
  );
  if (listingsError) throw listingsError;

  return bundle.id;
}

export async function createFleetCheckout(
  bundleId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-fleet-checkout', {
    body: { bundleId, successUrl, cancelUrl },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.url as string;
}

/** Only ever called on a bundle still 'draft' — abandoning Checkout shouldn't leave half-published listings or an orphaned bundle behind. */
export async function deletePendingFleetListings(bundleId: string): Promise<void> {
  await supabase.from('listings').delete().eq('bundle_id', bundleId).eq('fee_status', 'pending');
  await supabase.from('listing_bundles').update({ status: 'cancelled' }).eq('id', bundleId).eq('status', 'draft');
}

export async function fetchListingFeeStatus(listingId: string): Promise<string | null> {
  const { data } = await supabase
    .from('listings')
    .select('fee_status')
    .eq('id', listingId)
    .maybeSingle();
  return data?.fee_status ?? null;
}

// --- In-platform payments (Stripe Connect) ---

/** Client secret for Stripe's embedded Connect onboarding/management UI — rendered inline, no redirect to a Stripe-hosted page. */
export async function createConnectAccountSession(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-connect-account-session');
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.clientSecret as string;
}

export async function refreshConnectStatus(): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('refresh-connect-status');
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return !!data.chargesEnabled;
}

export async function createPurchaseCheckout(
  listingId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-purchase-checkout', {
    body: { listingId, successUrl, cancelUrl },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.url as string;
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export async function uploadListingPhoto(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be uploaded.');
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error('Photos must be under 8MB.');
  }
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('listing-photos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('listing-photos').getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteListingPhoto(userId: string, url: string): Promise<void> {
  const marker = `/listing-photos/${userId}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = url.slice(idx + '/listing-photos/'.length);
  await supabase.storage.from('listing-photos').remove([path]);
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** Uploads to a fixed per-user path (upsert) and writes profiles.avatar_url — one call does both. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be uploaded.');
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('Profile pictures must be under 5MB.');
  }
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // Cache-bust: the path is fixed per user, so without this the browser (and
  // the API's own image cache) would keep showing the pre-upload picture.
  const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);
  if (profileError) throw profileError;

  return avatarUrl;
}

export async function isSaved(userId: string, listingId: string): Promise<boolean> {
  const { data } = await supabase
    .from('saved_listings')
    .select('listing_id')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .maybeSingle();
  return !!data;
}

export async function toggleSaved(userId: string, listingId: string): Promise<boolean> {
  const saved = await isSaved(userId, listingId);
  if (saved) {
    await supabase
      .from('saved_listings')
      .delete()
      .eq('user_id', userId)
      .eq('listing_id', listingId);
    return false;
  }
  await supabase.from('saved_listings').insert({ user_id: userId, listing_id: listingId });
  return true;
}

export async function fetchSavedListings(userId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('saved_listings')
    .select(`listing_id, listings(${LISTING_SELECT})`)
    .eq('user_id', userId);
  if (error) throw error;
  return ((data ?? []) as unknown as { listings: ListingRow }[])
    .filter((row) => row.listings)
    .map((row) => mapListing(row.listings));
}

export async function sendMessage(listingId: string, senderId: string, body: string) {
  const { error } = await supabase
    .from('messages')
    .insert({ listing_id: listingId, sender_id: senderId, body });
  if (error) throw error;
}

export async function hasMessaged(listingId: string, senderId: string): Promise<boolean> {
  const { data } = await supabase
    .from('messages')
    .select('id')
    .eq('listing_id', listingId)
    .eq('sender_id', senderId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

export interface MessageThread {
  listingId: string;
  listingTitle: string;
  listingPrice: number | null;
  listingCurrency: Currency;
  body: string;
  sentAt: string;
}

export async function fetchSentMessages(userId: string): Promise<MessageThread[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('listing_id, body, sent_at, listings(title, price, currency)')
    .eq('sender_id', userId)
    .order('sent_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as {
    listing_id: string;
    body: string;
    sent_at: string;
    listings: { title: string; price: number | null; currency: string } | null;
  }[])
    .filter((row) => row.listings)
    .map((row) => ({
      listingId: row.listing_id,
      listingTitle: row.listings!.title,
      listingPrice: row.listings!.price,
      listingCurrency: row.listings!.currency as Currency,
      body: row.body,
      sentAt: row.sent_at,
    }));
}

export async function fetchProfile(id: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

interface FitProfileRow {
  primary_sport: string | null;
  disability_notes: string | null;
  classification: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  seat_width_cm: number | null;
  seat_depth_cm: number | null;
  inseam_cm: number | null;
  notes: string | null;
}

function mapFitProfile(row: FitProfileRow | null): FitProfile {
  return {
    primarySport: (row?.primary_sport as FitProfile['primarySport']) ?? null,
    disabilityNotes: row?.disability_notes ?? '',
    classification: row?.classification ?? '',
    heightCm: row?.height_cm ?? null,
    weightKg: row?.weight_kg ?? null,
    seatWidthCm: row?.seat_width_cm ?? null,
    seatDepthCm: row?.seat_depth_cm ?? null,
    inseamCm: row?.inseam_cm ?? null,
    notes: row?.notes ?? '',
  };
}

export async function fetchFitProfile(userId: string): Promise<FitProfile> {
  const { data, error } = await supabase
    .from('fit_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return mapFitProfile(data as FitProfileRow | null);
}

export async function saveFitProfile(userId: string, profile: FitProfile): Promise<void> {
  const { error } = await supabase.from('fit_profiles').upsert({
    user_id: userId,
    primary_sport: profile.primarySport,
    disability_notes: profile.disabilityNotes || null,
    classification: profile.classification || null,
    height_cm: profile.heightCm,
    weight_kg: profile.weightKg,
    seat_width_cm: profile.seatWidthCm,
    seat_depth_cm: profile.seatDepthCm,
    inseam_cm: profile.inseamCm,
    notes: profile.notes || null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Wanted board
// ---------------------------------------------------------------------------

interface WantedRow {
  id: string;
  buyer_id: string;
  title: string;
  sport: string;
  category: string;
  description: string;
  max_price: number | null;
  currency: string;
  country: string;
  open_to_international: boolean;
  status: 'open' | 'fulfilled';
  seat_width_cm: number | null;
  seat_depth_cm: number | null;
  min_user_height_cm: number | null;
  max_user_height_cm: number | null;
  min_user_weight_kg: number | null;
  max_user_weight_kg: number | null;
  created_at: string;
  profiles: {
    id: string;
    name: string;
    club: string | null;
    verified: boolean;
    rating: number;
    sales_count: number;
    created_at: string;
    avatar_url: string | null;
  } | null;
}

function mapWantedPost(row: WantedRow): WantedPost {
  const buyer = row.profiles;
  return {
    id: row.id,
    title: row.title,
    sport: row.sport as WantedPost['sport'],
    category: row.category,
    description: row.description,
    maxPrice: row.max_price,
    currency: row.currency as Currency,
    country: row.country,
    openToInternational: row.open_to_international,
    status: row.status,
    createdAt: row.created_at,
    seatWidthCm: row.seat_width_cm ?? undefined,
    seatDepthCm: row.seat_depth_cm ?? undefined,
    minUserHeightCm: row.min_user_height_cm ?? undefined,
    maxUserHeightCm: row.max_user_height_cm ?? undefined,
    minUserWeightKg: row.min_user_weight_kg ?? undefined,
    maxUserWeightKg: row.max_user_weight_kg ?? undefined,
    buyer: {
      id: buyer?.id ?? row.buyer_id,
      name: buyer?.name ?? 'Relay member',
      verified: buyer?.verified ?? false,
      club: buyer?.club ?? undefined,
      rating: buyer?.rating ?? 5,
      salesCount: buyer?.sales_count ?? 0,
      memberSince: buyer?.created_at ? buyer.created_at.slice(0, 4) : '2026',
      avatarUrl: buyer?.avatar_url ?? null,
    },
  };
}

const WANTED_SELECT =
  '*, profiles:profiles!wanted_listings_buyer_id_fkey(id, name, club, verified, rating, sales_count, created_at, avatar_url)';

export async function fetchWantedPosts(): Promise<WantedPost[]> {
  const { data, error } = await supabase
    .from('wanted_listings')
    .select(WANTED_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as WantedRow[]).map(mapWantedPost);
}

export async function fetchWantedPost(id: string): Promise<WantedPost | null> {
  const { data, error } = await supabase
    .from('wanted_listings')
    .select(WANTED_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapWantedPost(data as unknown as WantedRow) : null;
}

export async function fetchWantedPostsByBuyer(buyerId: string): Promise<WantedPost[]> {
  const { data, error } = await supabase
    .from('wanted_listings')
    .select(WANTED_SELECT)
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as WantedRow[]).map(mapWantedPost);
}

export interface NewWantedInput {
  title: string;
  sport: string;
  category: string;
  description: string;
  maxPrice: number | null;
  currency: Currency;
  country: string;
  openToInternational: boolean;
  seatWidthCm?: number | null;
  seatDepthCm?: number | null;
  minUserHeightCm?: number | null;
  maxUserHeightCm?: number | null;
  minUserWeightKg?: number | null;
  maxUserWeightKg?: number | null;
}

export async function createWantedPost(buyerId: string, input: NewWantedInput): Promise<string> {
  const { data, error } = await supabase
    .from('wanted_listings')
    .insert({
      buyer_id: buyerId,
      title: input.title,
      sport: input.sport,
      category: input.category,
      description: input.description,
      max_price: input.maxPrice,
      currency: input.currency,
      country: input.country,
      open_to_international: input.openToInternational,
      seat_width_cm: input.seatWidthCm ?? null,
      seat_depth_cm: input.seatDepthCm ?? null,
      min_user_height_cm: input.minUserHeightCm ?? null,
      max_user_height_cm: input.maxUserHeightCm ?? null,
      min_user_weight_kg: input.minUserWeightKg ?? null,
      max_user_weight_kg: input.maxUserWeightKg ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function markWantedStatus(id: string, status: 'open' | 'fulfilled') {
  const { error } = await supabase.from('wanted_listings').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function sendMessageToWanted(wantedId: string, senderId: string, body: string) {
  const { error } = await supabase
    .from('messages')
    .insert({ wanted_id: wantedId, sender_id: senderId, body });
  if (error) throw error;
}

export async function hasMessagedWanted(wantedId: string, senderId: string): Promise<boolean> {
  const { data } = await supabase
    .from('messages')
    .select('id')
    .eq('wanted_id', wantedId)
    .eq('sender_id', senderId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

export interface WantedMessageThread {
  wantedId: string;
  wantedTitle: string;
  wantedMaxPrice: number | null;
  wantedCurrency: Currency;
  body: string;
  sentAt: string;
}

export async function fetchSentWantedMessages(userId: string): Promise<WantedMessageThread[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('wanted_id, body, sent_at, wanted_listings(title, max_price, currency)')
    .eq('sender_id', userId)
    .not('wanted_id', 'is', null)
    .order('sent_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as {
    wanted_id: string;
    body: string;
    sent_at: string;
    wanted_listings: { title: string; max_price: number | null; currency: string } | null;
  }[])
    .filter((row) => row.wanted_listings)
    .map((row) => ({
      wantedId: row.wanted_id,
      wantedTitle: row.wanted_listings!.title,
      wantedMaxPrice: row.wanted_listings!.max_price,
      wantedCurrency: row.wanted_listings!.currency as Currency,
      body: row.body,
      sentAt: row.sent_at,
    }));
}

// ---------------------------------------------------------------------------
// Cross-matching: surfaces the other board when someone posts a listing or
// a want. Server-side filter narrows by sport + open status (cheap, uses
// the index); the numeric fit comparison itself runs client-side since it's
// a handful of small comparisons, not worth a bespoke SQL function yet.
// ---------------------------------------------------------------------------

export async function fetchMatchingWantedPosts(listing: Listing): Promise<WantedPost[]> {
  const { data, error } = await supabase
    .from('wanted_listings')
    .select(WANTED_SELECT)
    .eq('sport', listing.sport)
    .eq('status', 'open')
    .neq('buyer_id', listing.seller.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as WantedRow[])
    .map(mapWantedPost)
    .filter((wanted) => listingMatchesWanted(listing, wanted));
}

export async function fetchMatchingListings(wanted: WantedPost): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('sport', wanted.sport)
    .neq('seller_id', wanted.buyer.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as ListingRow[])
    .map(mapListing)
    .filter((listing) => listingMatchesWanted(listing, wanted));
}

// --- Listing reports ---

export async function fileListingReport(
  listingId: string,
  listingTitle: string,
  reporterId: string,
  reason: string,
  details: string,
): Promise<void> {
  const { error } = await supabase.from('listing_reports').insert({
    listing_id: listingId,
    listing_title_snapshot: listingTitle,
    reporter_id: reporterId,
    reason,
    details: details.trim() || null,
  });
  if (error) throw error;
}

// --- Reviews ---

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewerName: string;
}

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: { name: string } | null;
}

// Explicit FK name needed: reviews has two FKs to profiles (reviewer and
// reviewee), same ambiguity issue as the listings->profiles join.
const REVIEW_SELECT = 'id, rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey(name)';

export async function fetchReviewsForSeller(sellerId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_SELECT)
    .eq('reviewee_id', sellerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as ReviewRow[]).map((row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    reviewerName: row.reviewer?.name ?? 'Relay member',
  }));
}

export interface CompletedOrder {
  id: string;
  listingId: string;
  sellerId: string;
  alreadyReviewed: boolean;
}

/** Most recent paid order for this buyer on this listing, with whether they've already reviewed it. */
export async function fetchCompletedOrder(listingId: string, buyerId: string): Promise<CompletedOrder | null> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, listing_id, seller_id')
    .eq('listing_id', listingId)
    .eq('buyer_id', buyerId)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!order) return null;

  const { data: review } = await supabase
    .from('reviews')
    .select('id')
    .eq('order_id', order.id)
    .maybeSingle();

  return {
    id: order.id,
    listingId: order.listing_id,
    sellerId: order.seller_id,
    alreadyReviewed: !!review,
  };
}

export async function createReview(
  orderId: string,
  listingId: string,
  reviewerId: string,
  revieweeId: string,
  rating: number,
  comment: string,
): Promise<void> {
  const { error } = await supabase.from('reviews').insert({
    order_id: orderId,
    listing_id: listingId,
    reviewer_id: reviewerId,
    reviewee_id: revieweeId,
    rating,
    comment: comment.trim() || null,
  });
  if (error) throw error;
}

// --- Admin moderation ---
// Gated by RLS (profiles.is_admin) — these calls simply fail for a
// non-admin, they don't rely on the client to self-police who can see them.

export interface AdminReport {
  id: string;
  reason: string;
  details: string | null;
  status: 'open' | 'resolved';
  createdAt: string;
  reporterName: string;
  listingId: string | null;
  listingTitle: string;
}

interface AdminReportRow {
  id: string;
  reason: string;
  details: string | null;
  status: 'open' | 'resolved';
  created_at: string;
  listing_id: string | null;
  listing_title_snapshot: string | null;
  reporter: { name: string } | null;
  listing: { title: string } | null;
}

const ADMIN_REPORT_SELECT =
  'id, reason, details, status, created_at, listing_id, listing_title_snapshot, reporter:profiles!listing_reports_reporter_id_fkey(name), listing:listings(title)';

export async function fetchAllReports(): Promise<AdminReport[]> {
  const { data, error } = await supabase
    .from('listing_reports')
    .select(ADMIN_REPORT_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as AdminReportRow[]).map((row) => ({
    id: row.id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.created_at,
    reporterName: row.reporter?.name ?? 'Relay member',
    listingId: row.listing_id,
    listingTitle: row.listing?.title ?? row.listing_title_snapshot ?? 'Listing removed',
  }));
}

export async function updateReportStatus(reportId: string, status: 'open' | 'resolved'): Promise<void> {
  const { error } = await supabase.from('listing_reports').update({ status }).eq('id', reportId);
  if (error) throw error;
}

/** Admin-only removal — distinct from deletePendingListing, which only ever lets a seller delete their own still-pending listing. */
export async function adminDeleteListing(listingId: string): Promise<void> {
  const { error } = await supabase.from('listings').delete().eq('id', listingId);
  if (error) throw error;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  club: string | null;
  verified: boolean;
  isAdmin: boolean;
  rating: number;
  salesCount: number;
  payoutsEnabled: boolean;
  createdAt: string;
  bannedUntil: string | null;
}

export async function fetchAllUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.functions.invoke('admin-list-users');
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.users as AdminUser[];
}

export type AdminUserAction = 'verify' | 'unverify' | 'ban' | 'unban' | 'grantAdmin' | 'revokeAdmin';

export async function updateUserAdminAction(userId: string, action: AdminUserAction): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-update-user', {
    body: { userId, action },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

// --- Admin order / dispute visibility ---

export interface AdminOrder {
  id: string;
  amount: number;
  currency: Currency;
  platformFeeAmount: number;
  status: 'pending' | 'paid' | 'cancelled';
  createdAt: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  disputedAt: string | null;
  disputeStatus: string | null;
  listingId: string | null;
  listingTitle: string;
  bundleId: string | null;
  buyerName: string;
  sellerName: string;
}

interface AdminOrderRow {
  id: string;
  amount: number;
  currency: string;
  platform_fee_amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  created_at: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  disputed_at: string | null;
  dispute_status: string | null;
  bundle_listing_ids: string[] | null;
  listing: { id: string; title: string } | null;
  bundle: { id: string; title: string } | null;
  buyer: { name: string } | null;
  seller: { name: string } | null;
}

// Explicit FK names needed on both profiles joins — orders has two separate
// FKs to profiles (buyer_id, seller_id), same ambiguity as elsewhere in
// this file.
const ADMIN_ORDER_SELECT =
  'id, amount, currency, platform_fee_amount, status, created_at, stripe_checkout_session_id, stripe_payment_intent_id, disputed_at, dispute_status, bundle_listing_ids, listing:listings(id, title), bundle:listing_bundles(id, title), buyer:profiles!orders_buyer_id_fkey(name), seller:profiles!orders_seller_id_fkey(name)';

export async function fetchAllOrders(): Promise<AdminOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ADMIN_ORDER_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as AdminOrderRow[]).map((row) => ({
    id: row.id,
    amount: row.amount,
    currency: row.currency as Currency,
    platformFeeAmount: row.platform_fee_amount,
    status: row.status,
    createdAt: row.created_at,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    disputedAt: row.disputed_at,
    disputeStatus: row.dispute_status,
    listingId: row.listing?.id ?? null,
    listingTitle: row.bundle
      ? `Fleet bundle: ${row.bundle.title} (${row.bundle_listing_ids?.length ?? 0} items)`
      : (row.listing?.title ?? 'Listing removed'),
    bundleId: row.bundle?.id ?? null,
    buyerName: row.buyer?.name ?? 'Relay member',
    sellerName: row.seller?.name ?? 'Relay member',
  }));
}

// --- Admin audit log ---
// Read-only from the client by design — see the migration comment for why
// there's deliberately no INSERT policy: rows are only ever written by
// SECURITY DEFINER triggers or the admin-update-user edge function, both of
// which bypass RLS, so an admin can't fabricate or erase their own entries.

export interface AdminAuditLogEntry {
  id: string;
  adminName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

interface AdminAuditLogRow {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  admin: { name: string } | null;
}

const AUDIT_LOG_SELECT =
  'id, action, target_type, target_id, details, created_at, admin:profiles!admin_audit_log_admin_id_fkey(name)';

export async function fetchAuditLog(): Promise<AdminAuditLogEntry[]> {
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select(AUDIT_LOG_SELECT)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as unknown as AdminAuditLogRow[]).map((row) => ({
    id: row.id,
    adminName: row.admin?.name ?? 'Former admin',
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    details: row.details,
    createdAt: row.created_at,
  }));
}

// --- Fleet bundles (club fleet liquidations) ---
// A bundle groups several of a seller's own listings into one sellable lot,
// bought in a single checkout. See supabase/migrations/20260906100000_fleet_bundles.sql.

interface BundleRow {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'sold' | 'cancelled';
  created_at: string;
  seller_id: string;
  profiles: {
    id: string;
    name: string;
    club: string | null;
    verified: boolean;
    rating: number;
    sales_count: number;
    created_at: string;
    stripe_connect_charges_enabled: boolean;
    avatar_url: string | null;
  } | null;
  listings: ListingRow[];
}

const BUNDLE_SELECT =
  'id, title, description, status, created_at, seller_id, profiles:profiles!listing_bundles_seller_id_fkey(id, name, club, verified, rating, sales_count, created_at, stripe_connect_charges_enabled, avatar_url), listings(*)';

function mapBundle(row: BundleRow): FleetBundle {
  const sellerProfile = row.profiles;
  const seller: Seller = {
    id: sellerProfile?.id ?? row.seller_id,
    name: sellerProfile?.name ?? 'Relay member',
    verified: sellerProfile?.verified ?? false,
    club: sellerProfile?.club ?? undefined,
    rating: sellerProfile?.rating ?? 5,
    salesCount: sellerProfile?.sales_count ?? 0,
    memberSince: sellerProfile?.created_at ? sellerProfile.created_at.slice(0, 4) : '2026',
    payoutsEnabled: sellerProfile?.stripe_connect_charges_enabled ?? false,
    avatarUrl: sellerProfile?.avatar_url ?? null,
  };
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    seller,
    // Every listing in a bundle belongs to the bundle's own seller, so the
    // nested `listings(*)` select (member columns only, no per-row profile
    // join needed) is paired back up with the seller profile fetched above.
    listings: (row.listings ?? []).map((l) => mapListing({ ...l, profiles: sellerProfile })),
  };
}

export async function fetchActiveBundles(): Promise<FleetBundle[]> {
  const { data, error } = await supabase
    .from('listing_bundles')
    .select(BUNDLE_SELECT)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as BundleRow[]).map(mapBundle);
}

export async function fetchBundle(id: string): Promise<FleetBundle | null> {
  const { data, error } = await supabase
    .from('listing_bundles')
    .select(BUNDLE_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapBundle(data as unknown as BundleRow) : null;
}

export async function fetchBundlesBySeller(sellerId: string): Promise<FleetBundle[]> {
  const { data, error } = await supabase
    .from('listing_bundles')
    .select(BUNDLE_SELECT)
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as BundleRow[]).map(mapBundle);
}

export async function createFleetBundle(
  sellerId: string,
  title: string,
  description: string,
  listingIds: string[],
): Promise<string> {
  const { data: bundle, error: bundleError } = await supabase
    .from('listing_bundles')
    .insert({ seller_id: sellerId, title, description })
    .select('id')
    .single();
  if (bundleError) throw bundleError;

  // Extra `eq('seller_id', ...)` guard so this can never attach someone
  // else's listing to your bundle even if a listingId were spoofed —
  // belt-and-braces alongside the RLS policy that already enforces it.
  const { error: updateError } = await supabase
    .from('listings')
    .update({ bundle_id: bundle.id })
    .in('id', listingIds)
    .eq('seller_id', sellerId);
  if (updateError) throw updateError;

  return bundle.id;
}

// --- Custom order invoices ---
// A seller-initiated invoice: pick some of your own unsold listings, name a
// negotiated total, send it to a buyer you've already been talking to. Kept
// deliberately separate from the instant single-listing purchase flow above
// — see supabase/migrations/20260907090000_custom_order_invoices.sql and
// the create-custom-order / pay-custom-order / cancel-custom-order edge
// functions for why (negotiate first, pay at the end, not the other way
// round).

export interface BuyerLookup {
  id: string;
  name: string;
}

export async function findBuyerByEmail(email: string): Promise<BuyerLookup> {
  const { data, error } = await supabase.functions.invoke('find-buyer-by-email', {
    body: { email },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as BuyerLookup;
}

export async function createCustomOrder(
  buyerId: string,
  listingIds: string[],
  amount: number,
  currency: Currency,
  bundleId?: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-custom-order', {
    body: { buyerId, listingIds, amount, currency, bundleId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.id as string;
}

export async function payCustomOrder(
  orderId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('pay-custom-order', {
    body: { orderId, successUrl, cancelUrl },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.url as string;
}

export async function cancelCustomOrder(orderId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('cancel-custom-order', {
    body: { orderId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export interface Invoice {
  id: string;
  role: 'buyer' | 'seller';
  amount: number;
  currency: Currency;
  platformFeeAmount: number;
  status: 'pending' | 'paid' | 'cancelled';
  createdAt: string;
  hasStripeSession: boolean;
  itemCount: number;
  counterpartyName: string;
}

interface InvoiceRow {
  id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  currency: string;
  platform_fee_amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  created_at: string;
  stripe_checkout_session_id: string | null;
  bundle_listing_ids: string[] | null;
  buyer: { name: string } | null;
  seller: { name: string } | null;
}

const INVOICE_SELECT =
  'id, buyer_id, seller_id, amount, currency, platform_fee_amount, status, created_at, stripe_checkout_session_id, bundle_listing_ids, buyer:profiles!orders_buyer_id_fkey(name), seller:profiles!orders_seller_id_fkey(name)';

/** Every custom-order invoice this user is either side of, most recent first. Single-listing instant purchases (bundle_listing_ids null) aren't invoices, so they're excluded. */
export async function fetchMyInvoices(userId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(INVOICE_SELECT)
    .not('bundle_listing_ids', 'is', null)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as InvoiceRow[]).map((row) => ({
    id: row.id,
    role: row.buyer_id === userId ? 'buyer' : 'seller',
    amount: row.amount,
    currency: row.currency as Currency,
    platformFeeAmount: row.platform_fee_amount,
    status: row.status,
    createdAt: row.created_at,
    hasStripeSession: !!row.stripe_checkout_session_id,
    itemCount: row.bundle_listing_ids?.length ?? 0,
    counterpartyName: (row.buyer_id === userId ? row.seller?.name : row.buyer?.name) ?? 'Relay member',
  }));
}
