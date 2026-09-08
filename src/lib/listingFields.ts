import type { Sport, Currency } from '@/types';

// Shared between CreateListing (one item) and CreateFleetListing (many items
// at once) so the two forms never drift on what fields/labels a sport gets.

export const CURRENCIES: Currency[] = ['GBP', 'USD', 'EUR', 'AUD', 'CAD'];

export const MEASUREMENT_FIELDS: Record<Sport, string[]> = {
  basketball: ['Seat width', 'Seat depth', 'Camber', 'Wheel size'],
  rugby: ['Seat width', 'Camber', 'Bumper type'],
  racing: ['Frame size / category', 'Wheel size', 'Build height'],
  handcycling: ['Frame size', 'Gearing', 'Wheel size'],
  boccia: ['Height range', 'Release mechanism'],
  swimming: ['Dimensions', 'Fitting'],
  tennis: ['Seat width', 'Camber', 'Wheel size'],
  other: ['Key dimensions'],
};

export const CATEGORY_LABEL: Record<Sport, string> = {
  basketball: 'Sports wheelchair',
  rugby: 'Sports wheelchair',
  racing: 'Racing equipment',
  handcycling: 'Handcycle',
  boccia: 'Boccia equipment',
  swimming: 'Pool equipment',
  tennis: 'Sports wheelchair',
  other: 'Adaptive equipment',
};

// Which structured, filterable fit fields make sense to ask for per sport —
// a seat width doesn't mean anything for a boccia ramp, and a running blade
// doesn't have one, but does have a recommended user weight/height range.
export const SHOWS_SEAT_FIELDS: Sport[] = ['basketball', 'rugby', 'tennis', 'racing'];
export const SHOWS_WEIGHT_CAPACITY: Sport[] = ['basketball', 'rugby', 'tennis', 'racing', 'handcycling'];
export const SHOWS_USER_RANGE: Sport[] = ['racing', 'handcycling', 'other'];
