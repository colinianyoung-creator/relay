import type { Sport } from '@/types';
import { ListingPhoto } from './ListingPhoto';

/**
 * A listing's cover image: the seller's first real photo if they added one,
 * otherwise the same gradient category art used everywhere else — so a
 * listing never looks "broken" just because photos are optional.
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
      <img
        src={photo}
        alt=""
        className={`object-cover ${className}`}
        loading="lazy"
      />
    );
  }
  return <ListingPhoto sport={sport} className={className} />;
}
