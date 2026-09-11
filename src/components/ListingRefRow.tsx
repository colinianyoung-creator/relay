import { Boxes, MapPin } from 'lucide-react';
import { ListingCover } from './ListingCover';
import { countryCode, formatPrice } from '@/lib/format';
import type { Currency, Sport } from '@/types';

/**
 * A compact "what listing is this about" reference — a real thumbnail plus
 * title and location, instead of a generic icon-in-a-circle. Used anywhere
 * a message thread, order, or offer needs to point back at the listing it's
 * about (Account tabs, the inbox), so those all read like a real
 * marketplace rather than a bare transaction log.
 */
export function ListingRefRow({
  title,
  photos,
  sport,
  location,
  country,
  price,
  currency,
}: {
  title: string;
  photos?: string[] | null;
  sport?: Sport | null;
  location?: string | null;
  country?: string | null;
  /** Pass both to show a price badge alongside the title. */
  price?: number | null;
  currency?: Currency;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {sport ? (
        <ListingCover
          sport={sport}
          photos={photos ?? undefined}
          className="h-12 w-12 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-line)]/40 text-[var(--color-ink-soft)]">
          <Boxes size={18} />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {title}
          {currency !== undefined && (
            <span className="ml-1.5 font-normal text-[var(--color-ink-soft)]">
              {formatPrice(price ?? null, currency)}
            </span>
          )}
        </p>
        {location && (
          <p className="flex items-center gap-1 text-xs text-[var(--color-ink-soft)]">
            <MapPin size={11} />
            {location}
            {country ? `, ${countryCode(country)}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
