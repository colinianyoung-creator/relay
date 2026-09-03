import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Loader2, Ruler } from 'lucide-react';
import { listings as demoListings } from '@/data/listings';
import { fetchListings, fetchFitProfile } from '@/lib/supabaseData';
import { useAuth } from '@/lib/auth';
import { isLikelyFit, hasAnyProfileData } from '@/lib/fitMatch';
import { SPORTS, CONDITIONS, COUNTRIES, type Sport, type Condition, type Listing, type FitProfile } from '@/types';
import { ListingCard } from '@/components/ListingCard';

export function Browse() {
  const { user } = useAuth();
  const [realListings, setRealListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [fitProfile, setFitProfile] = useState<FitProfile | null>(null);
  const [fitsMeOnly, setFitsMeOnly] = useState(false);

  useEffect(() => {
    fetchListings()
      .then(setRealListings)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) {
      setFitProfile(null);
      return;
    }
    fetchFitProfile(user.id).then(setFitProfile);
  }, [user]);

  const listings = useMemo(() => [...realListings, ...demoListings], [realListings]);
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState<Sport | 'all'>('all');
  const [condition, setCondition] = useState<Condition | 'all'>('all');
  const [country, setCountry] = useState<string | 'all'>('all');
  const [freeOnly, setFreeOnly] = useState(false);

  const profileIsUsable = hasAnyProfileData(fitProfile);

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (sport !== 'all' && l.sport !== sport) return false;
      if (condition !== 'all' && l.condition !== condition) return false;
      if (country !== 'all' && l.country !== country && !l.shipsInternationally) return false;
      if (freeOnly && l.price !== null) return false;
      if (fitsMeOnly && profileIsUsable && !isLikelyFit(l, fitProfile)) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!l.title.toLowerCase().includes(q) && !l.category.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [listings, query, sport, condition, country, freeOnly, fitsMeOnly, profileIsUsable, fitProfile]);

  return (
    <div>
      <section className="border-b border-[var(--color-line)] bg-[var(--color-paper-raised)]">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-brand)]">
            Adaptive & para-sport equipment
          </p>
          <h1 className="max-w-2xl text-4xl leading-[1.08] sm:text-5xl">
            Kit that's outgrown one athlete, ready for its next season.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] text-[var(--color-ink-soft)]">
            Buy and sell sports wheelchairs, handcycles, running blades and adaptive kit
            directly with clubs, families and athletes worldwide — matched by size, sport
            and classification, not a Facebook wall.
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

          {user && (
            <button
              onClick={() => setFitsMeOnly((v) => !v)}
              disabled={!profileIsUsable}
              title={
                profileIsUsable ? undefined : 'Add your measurements in Account → Fit profile first'
              }
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                fitsMeOnly
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]'
                  : 'border-[var(--color-line)] bg-[var(--color-paper-raised)] text-[var(--color-ink-soft)]'
              }`}
            >
              <Ruler size={13} /> Fits me
            </button>
          )}

          <span className="ml-auto flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)]">
            {loading && <Loader2 size={13} className="animate-spin" />}
            {filtered.length} listing{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        {loadError && (
          <p className="mb-6 text-sm text-[var(--color-brand-dark)]">
            Couldn't reach the live marketplace right now — showing demo listings only.
          </p>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-20 text-center text-[var(--color-ink-soft)]">
            Nothing matches those filters yet — try widening your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                fitProfile={profileIsUsable ? fitProfile : null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
