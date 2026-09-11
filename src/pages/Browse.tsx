import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, SlidersHorizontal, Loader2, Ruler, BellPlus, Check } from 'lucide-react';
import { listings as demoListings } from '@/data/listings';
import {
  fetchListings,
  fetchActiveBundles,
  fetchFitProfile,
  saveFitProfile,
  createSavedSearch,
} from '@/lib/supabaseData';
import { useAuth } from '@/lib/auth';
import { isLikelyFit, hasAnyProfileData } from '@/lib/fitMatch';
import {
  SPORTS,
  CONDITIONS,
  COUNTRIES,
  type Sport,
  type Condition,
  type Listing,
  type FitProfile,
  type FleetBundle,
} from '@/types';
import { ListingCard } from '@/components/ListingCard';
import { BundleCard } from '@/components/BundleCard';
import { HeroArt } from '@/components/HeroArt';
import { MySizeModal, type QuickFitValues } from '@/components/MySizeModal';
import { AuthModal } from '@/components/AuthModal';

type BrowseEntry =
  | { kind: 'listing'; date: string; listing: Listing }
  | { kind: 'bundle'; date: string; bundle: FleetBundle };

const EMPTY_FIT_PROFILE: FitProfile = {
  primarySport: null,
  disabilityNotes: '',
  classification: '',
  heightCm: null,
  weightKg: null,
  seatWidthCm: null,
  seatDepthCm: null,
  inseamCm: null,
  notes: '',
};

export function Browse() {
  const { user } = useAuth();
  const [realListings, setRealListings] = useState<Listing[]>([]);
  const [bundles, setBundles] = useState<FleetBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [fitProfile, setFitProfile] = useState<FitProfile | null>(null);
  const [fitsMeOnly, setFitsMeOnly] = useState(false);
  const [quickFit, setQuickFit] = useState<QuickFitValues | null>(null);
  const [showSizeModal, setShowSizeModal] = useState(false);

  useEffect(() => {
    fetchListings()
      .then(setRealListings)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
    // Club gear lots aren't tied to the demo-listing fallback below — they're
    // real or they don't show, regardless of whether individual listings do.
    fetchActiveBundles()
      .then(setBundles)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) {
      setFitProfile(null);
      return;
    }
    fetchFitProfile(user.id).then(setFitProfile);
  }, [user]);

  // Demo listings are there to keep Browse from looking empty before real
  // sellers show up — once at least one real listing exists, they're no
  // longer needed and would just look like clutter mixed in with genuine,
  // buyable items.
  const listings = useMemo(
    () => (realListings.length > 0 ? realListings : demoListings),
    [realListings],
  );
  const entries = useMemo<BrowseEntry[]>(
    () => [
      ...listings.map((listing): BrowseEntry => ({ kind: 'listing', date: listing.postedAt, listing })),
      ...bundles.map((bundle): BrowseEntry => ({ kind: 'bundle', date: bundle.createdAt, bundle })),
    ],
    [listings, bundles],
  );
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState<Sport | 'all'>('all');
  const [condition, setCondition] = useState<Condition | 'all'>('all');
  const [country, setCountry] = useState<string | 'all'>('all');
  const [freeOnly, setFreeOnly] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState<'newest' | 'price-asc' | 'price-desc'>('newest');

  const [showAuth, setShowAuth] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [savingSearch, setSavingSearch] = useState(false);
  const [searchSaved, setSearchSaved] = useState(false);
  const [saveSearchError, setSaveSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !pendingActionRef.current) return;
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action();
  }, [user]);

  function requireAuth(action: () => void) {
    if (!user) {
      pendingActionRef.current = action;
      setShowAuth(true);
      return;
    }
    action();
  }

  const hasActiveFilters =
    sport !== 'all' || condition !== 'all' || country !== 'all' || freeOnly || !!minPrice || !!maxPrice;

  async function handleSaveSearch() {
    requireAuth(async () => {
      if (!user) return;
      setSaveSearchError(null);
      setSavingSearch(true);
      try {
        await createSavedSearch(user.id, {
          sport: sport === 'all' ? null : sport,
          condition: condition === 'all' ? null : condition,
          country: country === 'all' ? null : country,
          minPrice: minPrice ? Number(minPrice) : null,
          maxPrice: maxPrice ? Number(maxPrice) : null,
          freeOnly,
        });
        setSearchSaved(true);
        setTimeout(() => setSearchSaved(false), 3000);
      } catch (err) {
        setSaveSearchError(err instanceof Error ? err.message : 'Could not save that search.');
      } finally {
        setSavingSearch(false);
      }
    });
  }

  const profileIsUsable = hasAnyProfileData(fitProfile);
  // Saved account profile wins if it has anything usable; otherwise fall back to
  // whatever was entered ad hoc in the "Your size" modal for this session only.
  const activeFitProfile: FitProfile | null = profileIsUsable
    ? fitProfile
    : quickFit
      ? { ...EMPTY_FIT_PROFILE, ...quickFit }
      : null;
  const activeProfileUsable = hasAnyProfileData(activeFitProfile);

  const filtered = useMemo(() => {
    const min = minPrice.trim() ? Number(minPrice) : null;
    const max = maxPrice.trim() ? Number(maxPrice) : null;

    // A club gear lot has no single sport/condition/price of its own — it's
    // matched against each filter by "does any item in the lot qualify",
    // same as how a buyer would actually judge whether it's worth opening.
    const result = entries.filter((entry) => {
      const items = entry.kind === 'bundle' ? entry.bundle.listings : [entry.listing];
      const price =
        entry.kind === 'bundle'
          ? entry.bundle.listings.reduce((sum, l) => sum + (l.price ?? 0), 0)
          : entry.listing.price;

      if (sport !== 'all' && !items.some((l) => l.sport === sport)) return false;
      if (condition !== 'all' && !items.some((l) => l.condition === condition)) return false;
      if (
        country !== 'all' &&
        !items.some((l) => l.country === country || l.shipsInternationally)
      ) {
        return false;
      }
      // A club gear lot is always a paid sale, never a free/donation listing.
      if (freeOnly && (entry.kind === 'bundle' || entry.listing.price !== null)) return false;
      // Raw numeric comparison, not currency-converted — mixed-currency
      // listings aren't normalised anywhere else in the app either.
      if (min !== null && (price ?? 0) < min) return false;
      if (max !== null && (price ?? 0) > max) return false;
      if (fitsMeOnly && activeFitProfile && !items.some((l) => isLikelyFit(l, activeFitProfile))) {
        return false;
      }
      if (query.trim()) {
        const q = query.toLowerCase();
        const title = entry.kind === 'bundle' ? entry.bundle.title : entry.listing.title;
        const haystack = [title, ...items.map((l) => l.title), ...items.map((l) => l.category)]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      const priceOf = (entry: BrowseEntry) =>
        entry.kind === 'bundle'
          ? entry.bundle.listings.reduce((sum, l) => sum + (l.price ?? 0), 0)
          : (entry.listing.price ?? 0);
      if (sort === 'price-asc') return priceOf(a) - priceOf(b);
      if (sort === 'price-desc') return priceOf(b) - priceOf(a);
      return b.date.localeCompare(a.date);
    });

    return result;
  }, [
    entries,
    query,
    sport,
    condition,
    country,
    freeOnly,
    minPrice,
    maxPrice,
    sort,
    fitsMeOnly,
    activeFitProfile,
  ]);

  return (
    <div>
      <section className="border-b border-[var(--color-line)] bg-[var(--color-paper-raised)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-brand)]">
              Adaptive & para-sport equipment
            </p>
            <h1 className="max-w-2xl text-4xl leading-[1.08] sm:text-5xl">
              The direct marketplace for adaptive sports equipment.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] text-[var(--color-ink-soft)]">
              Buy and sell sports wheelchairs, handcycles, running blades and adaptive kit
              directly with clubs, families and athletes worldwide — matched by size, sport
              and classification.
            </p>

            <div className="mt-8 flex max-w-xl items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-2.5 shadow-sm">
              <Search size={18} className="shrink-0 text-[var(--color-ink-soft)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search “racing chair”, “boccia ramp”, “handcycle”…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-ink-soft)]/70"
              />
            </div>
          </div>

          <HeroArt className="mx-auto hidden w-full max-w-sm sm:block" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
            <SlidersHorizontal size={13} /> Filter
          </span>

          <select
            value={sport}
            onChange={(e) => setSport(e.target.value as Sport | 'all')}
            className="rounded-full border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3.5 py-1.5 text-sm"
          >
            <option value="all">All sports</option>
            {SPORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition | 'all')}
            className="rounded-full border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3.5 py-1.5 text-sm"
          >
            <option value="all">Any condition</option>
            {CONDITIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-full border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3.5 py-1.5 text-sm"
          >
            <option value="all">Worldwide</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c} + ships-here listings
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3.5 py-1.5 text-sm">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min"
              className="w-14 bg-transparent outline-none placeholder:text-[var(--color-ink-soft)]/70"
            />
            <span className="text-[var(--color-ink-soft)]">–</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max"
              className="w-14 bg-transparent outline-none placeholder:text-[var(--color-ink-soft)]/70"
            />
          </div>

          <button
            onClick={() => setFreeOnly((v) => !v)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
              freeOnly
                ? 'border-[var(--color-moss)] bg-[var(--color-moss-soft)] text-[var(--color-moss)]'
                : 'border-[var(--color-line)] bg-[var(--color-paper-raised)] text-[var(--color-ink-soft)]'
            }`}
          >
            Free & donations only
          </button>

          <button
            onClick={() => {
              if (activeProfileUsable) {
                setFitsMeOnly((v) => !v);
              } else {
                setShowSizeModal(true);
              }
            }}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition ${
              fitsMeOnly && activeProfileUsable
                ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]'
                : 'border-[var(--color-line)] bg-[var(--color-paper-raised)] text-[var(--color-ink-soft)]'
            }`}
          >
            <Ruler size={13} /> {activeProfileUsable ? 'Fits me' : 'Set my size'}
          </button>

          {hasActiveFilters && (
            <button
              onClick={handleSaveSearch}
              disabled={savingSearch || searchSaved}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition disabled:opacity-70 ${
                searchSaved
                  ? 'border-[var(--color-moss)] bg-[var(--color-moss-soft)] text-[var(--color-moss)]'
                  : 'border-[var(--color-line)] bg-[var(--color-paper-raised)] text-[var(--color-ink-soft)]'
              }`}
            >
              {savingSearch ? (
                <Loader2 size={13} className="animate-spin" />
              ) : searchSaved ? (
                <Check size={13} />
              ) : (
                <BellPlus size={13} />
              )}
              {searchSaved ? 'Saved' : 'Save this search'}
            </button>
          )}

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="ml-auto rounded-full border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3.5 py-1.5 text-sm"
          >
            <option value="newest">Newest first</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>

          <span className="flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)]">
            {loading && <Loader2 size={13} className="animate-spin" />}
            {filtered.length} result{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        {loadError && (
          <p className="mb-6 text-sm text-[var(--color-brand-dark)]">
            Couldn't reach the live marketplace right now — showing demo listings only.
          </p>
        )}
        {saveSearchError && <p className="mb-6 text-sm text-[var(--color-brand-dark)]">{saveSearchError}</p>}

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-20 text-center text-[var(--color-ink-soft)]">
            Nothing matches those filters yet — try widening your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((entry) =>
              entry.kind === 'bundle' ? (
                <BundleCard key={entry.bundle.id} bundle={entry.bundle} />
              ) : (
                <ListingCard key={entry.listing.id} listing={entry.listing} fitProfile={activeFitProfile} />
              ),
            )}
          </div>
        )}
      </section>

      {showSizeModal && (
        <MySizeModal
          initial={{
            heightCm: activeFitProfile?.heightCm ?? null,
            weightKg: activeFitProfile?.weightKg ?? null,
            seatWidthCm: activeFitProfile?.seatWidthCm ?? null,
            seatDepthCm: activeFitProfile?.seatDepthCm ?? null,
          }}
          canSave={!!user}
          onApply={async (values, save) => {
            setQuickFit(values);
            setFitsMeOnly(true);
            if (save && user) {
              const merged: FitProfile = { ...(fitProfile ?? EMPTY_FIT_PROFILE), ...values };
              await saveFitProfile(user.id, merged);
              setFitProfile(merged);
              setQuickFit(null);
            }
          }}
          onClose={() => setShowSizeModal(false)}
        />
      )}

      {showAuth && (
        <AuthModal
          onClose={() => {
            pendingActionRef.current = null;
            setShowAuth(false);
          }}
          onAuthenticated={() => setShowAuth(false)}
        />
      )}
    </div>
  );
}
