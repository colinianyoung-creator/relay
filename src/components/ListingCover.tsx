import type { Sport } from '@/types';
import { ListingPhoto } from './ListingPhoto';

/**
 * A listing's cover image: the seller's first real photo if they added one,
 * otherwise the same gradient category art used everywhere else — so a
 * listing never looks "broken" just because photos are optional.
 *
 * Real photos are shown in full (object-contain on a neutral backing),
 * never cropped — a seller's photo of the actual item shouldn't have edges
 * cut off just to fill a frame, wherever this cover ends up being shown.
 */
export function ListingCover({
  sport,
  photos,
  className = '',
}: {
  sport: Sport;
  photos?: string[];
  className?: string;
}) {
  const photo = photos?.[0];
  if (photo) {
    return (
      <div className={`overflow-hidden bg-[var(--color-paper)] ${className}`}>
        <img src={photo} alt="" className="h-full w-full object-contain" loading="lazy" />
      </div>
    );
  }
  return <ListingPhoto sport={sport} className={className} />;
}
