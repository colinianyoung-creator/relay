import { Link } from 'react-router-dom';
import { BadgeCheck, Boxes, Globe2, MapPin } from 'lucide-react';
import type { FleetBundle } from '@/types';
import { ListingCover } from './ListingCover';
import { Badge } from './Badge';
import { formatPrice, timeAgo, countryCode } from '@/lib/format';

export function BundleCard({ bundle }: { bundle: FleetBundle }) {
  const total = bundle.listings.reduce((sum, l) => sum + (l.price ?? 0), 0);
  const currency = bundle.listings[0]?.currency ?? 'GBP';
  const shipsInternationally = bundle.listings.some((l) => l.shipsInternationally);
  const location = bundle.listings[0]?.location;
  const country = bundle.listings[0]?.country;

  return (
    <Link
      to={`/fleet/${bundle.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_rgba(27,26,23,0.18)]"
    >
      <div className="relative">
        <div className="grid h-44 grid-cols-3 gap-0.5 overflow-hidden bg-[var(--color-line)]">
          {bundle.listings.slice(0, 3).map((l) => (
            <ListingCover key={l.id} sport={l.sport} photos={l.photos} className="h-full w-full" />
          ))}
        </div>
        <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-[var(--color-ink)] shadow-sm">
          <Boxes size={11} /> Club lot
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-[var(--color-ink)] shadow-sm">
          {formatPrice(total, currency)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base leading-snug text-[var(--color-ink)]">
            {bundle.title}
          </h3>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge tone="brand">{bundle.listings.length} items</Badge>
          {shipsInternationally && (
            <Badge>
              <Globe2 size={11} /> Ships internationally
            </Badge>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-[var(--color-ink-soft)]">
          {location && country ? (
            <span className="flex items-center gap-1">
              <MapPin size={13} /> {location}, {countryCode(country)}
            </span>
          ) : (
            <span />
          )}
          <span>{timeAgo(bundle.createdAt)}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-ink-soft)]">
          {bundle.seller.verified && <BadgeCheck size={14} className="text-[var(--color-moss)]" />}
          {bundle.seller.name}
          {bundle.seller.club && (
            <span className="text-[var(--color-ink-soft)]/70">· {bundle.seller.club}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
