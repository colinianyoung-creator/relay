import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Boxes } from 'lucide-react';
import { fetchActiveBundles } from '@/lib/supabaseData';
import { ListingCover } from '@/components/ListingCover';
import { Badge } from '@/components/Badge';
import { formatPrice } from '@/lib/format';
import type { FleetBundle } from '@/types';

export function FleetBoard() {
  const [bundles, setBundles] = useState<FleetBundle[] | null>(null);

  useEffect(() => {
    fetchActiveBundles().then(setBundles);
  }, []);

  return (
    <div>
      <section className="border-b border-[var(--color-line)] bg-[var(--color-paper-raised)]">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-brand)]">
            Club Gear
          </p>
          <h1 className="max-w-2xl text-4xl leading-[1.08] sm:text-5xl">
            A club's whole kit, listed in one go.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] text-[var(--color-ink-soft)]">
            Clubs replacing their equipment every few years group the outgoing chairs into one
            lot — a newer or smaller club can buy the lot in a single checkout instead of
            sourcing kit one chair at a time.
          </p>
          <Link
            to="/sell/fleet/new"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
          >
            <Boxes size={16} /> List your gear
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-center">
          <span className="flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)]">
            {bundles === null && <Loader2 size={13} className="animate-spin" />}
            {bundles !== null && `${bundles.length} active bundle${bundles.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {bundles !== null && bundles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-20 text-center text-[var(--color-ink-soft)]">
            No club gear listed yet — clubs replacing their equipment will show up here.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {bundles?.map((bundle) => {
              const total = bundle.listings.reduce((sum, l) => sum + (l.price ?? 0), 0);
              return (
                <Link
                  key={bundle.id}
                  to={`/fleet/${bundle.id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_rgba(27,26,23,0.18)]"
                >
                  <div className="grid grid-cols-3 gap-0.5 bg-[var(--color-line)]">
                    {bundle.listings.slice(0, 3).map((l) => (
                      <ListingCover key={l.id} sport={l.sport} photos={l.photos} className="h-24 w-full" />
                    ))}
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 p-4">
                    <h3 className="font-display text-base leading-snug text-[var(--color-ink)]">
                      {bundle.title}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone="brand">{bundle.listings.length} items</Badge>
                      <Badge>{formatPrice(total, bundle.listings[0]?.currency ?? 'GBP')}</Badge>
                    </div>
                    <div className="mt-auto pt-2 text-xs font-medium text-[var(--color-ink-soft)]">
                      {bundle.seller.name}
                      {bundle.seller.club && <span className="text-[var(--color-ink-soft)]/70"> · {bundle.seller.club}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
