import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Boxes } from 'lucide-react';
import { fetchActiveBundles } from '@/lib/supabaseData';
import { BundleCard } from '@/components/BundleCard';
import { SearchBox } from '@/components/SearchBox';
import { matches, rankSuggestions, type Suggestion } from '@/lib/search';
import type { ClubGearBundle } from '@/types';

export function ClubGearBoard() {
  const [bundles, setBundles] = useState<ClubGearBundle[] | null>(null);
  const [query, setQuery] = useState('');

  const shown = useMemo(
    () =>
      bundles?.filter((b) =>
        matches(
          query,
          b.title,
          b.description,
          b.seller.name,
          ...b.listings.flatMap((l) => [l.title, l.category, l.location]),
        ),
      ) ?? null,
    [bundles, query],
  );

  const suggestions = useMemo(() => {
    if (!query.trim() || !bundles) return [];
    const candidates: Suggestion[] = bundles.flatMap((b) => [
      { label: b.title, hint: 'Club lot' },
      ...b.listings.map((l) => ({ label: l.title, hint: 'In a lot' })),
    ]);
    return rankSuggestions(query, candidates);
  }, [bundles, query]);

  useEffect(() => {
    fetchActiveBundles().then(setBundles);
  }, []);

  return (
    <div>
      <section className="border-b border-[var(--color-line)] bg-[var(--color-paper-raised)]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-brand)]">
            Club Gear
          </p>
          <h1 className="max-w-2xl text-4xl leading-[1.08] sm:text-5xl">
            Buy or sell complete gear bundles from adaptive sports teams.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] text-[var(--color-ink-soft)]">
            Clubs replacing their equipment every few years group the outgoing stock into one
            lot — buy bundles into a single checkout instead of sourcing kit one at a time.
          </p>
          <Link
            to="/sell/club-gear/new"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-dark)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-darker)]"
          >
            <Boxes size={16} /> List your gear
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)]" role="status">
            {bundles === null && <Loader2 size={13} className="animate-spin" />}
            {shown !== null &&
              (query.trim()
                ? `${shown.length} of ${bundles?.length} bundle${bundles?.length === 1 ? '' : 's'}`
                : `${shown.length} active bundle${shown.length === 1 ? '' : 's'}`)}
          </span>
          {bundles !== null && bundles.length > 0 && (
            <SearchBox
              value={query}
              onChange={setQuery}
              suggestions={suggestions}
              label="Search club gear"
              placeholder="Search lots and items…"
              className="w-full sm:max-w-sm"
            />
          )}
        </div>

        {shown !== null && shown.length === 0 && query.trim() && bundles && bundles.length > 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-20 text-center text-[var(--color-ink-soft)]">
            No club gear matches “{query.trim()}”.
          </div>
        ) : bundles !== null && bundles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-20 text-center text-[var(--color-ink-soft)]">
            No club gear listed yet — equipment being sold by clubs will show up here.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown?.map((bundle) => (
              <BundleCard key={bundle.id} bundle={bundle} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
