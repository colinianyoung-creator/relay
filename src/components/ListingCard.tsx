import { Link } from 'react-router-dom';
import { BadgeCheck, MapPin, Globe2, Ruler } from 'lucide-react';
import type { Listing, FitProfile } from '@/types';
import { ListingCover } from './ListingCover';
import { Badge } from './Badge';
import { formatPrice, timeAgo, countryCode } from '@/lib/format';
import { isLikelyFit, hasFitSignal } from '@/lib/fitMatch';

export function ListingCard({
  listing,
  fitProfile,
}: {
  listing: Listing;
  fitProfile?: FitProfile | null;
}) {
  const showsFitBadge = fitProfile && hasFitSignal(listing, fitProfile) && isLikelyFit(listing, fitProfile);

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_rgba(27,26,23,0.18)]"
    >
      <div className="relative">
        <ListingCover sport={listing.sport} photos={listing.photos} className="h-44 w-full" />
        {listing.feeStatus === 'pending' ? (
          <span className="absolute left-3 top-3 rounded-full bg-[var(--color-brand)] px-2.5 py-1 text-xs font-medium text-white shadow-sm">
            Payment pending
          </span>
        ) : listing.soldAt ? (
          <span className="absolute left-3 top-3 rounded-full bg-[var(--color-ink)] px-2.5 py-1 text-xs font-medium text-white shadow-sm">
            Sold
          </span>
        ) : (
          listing.featured && (
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-[var(--color-ink)] shadow-sm">
              Featured
            </span>
          )
        )}
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-[var(--color-ink)] shadow-sm">
          {formatPrice(listing.price, listing.currency)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base leading-snug text-[var(--color-ink)]">
            {listing.title}
          </h3>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge>{listing.category}</Badge>
          <Badge tone="moss">{listing.condition}</Badge>
          {showsFitBadge && (
            <Badge tone="moss">
              <Ruler size={11} /> Likely fits you
            </Badge>
          )}
          {listing.shipsInternationally && (
            <Badge>
              <Globe2 size={11} /> Ships internationally
            </Badge>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-[var(--color-ink-soft)]">
          <span className="flex items-center gap-1">
            <MapPin size={13} /> {listing.location}, {countryCode(listing.country)}
          </span>
          <span>{timeAgo(listing.postedAt)}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-ink-soft)]">
          {listing.seller.verified && (
            <BadgeCheck size={14} className="text-[var(--color-moss)]" />
          )}
          {listing.seller.name}
          {listing.seller.club && (
            <span className="text-[var(--color-ink-soft)]/70">· {listing.seller.club}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
