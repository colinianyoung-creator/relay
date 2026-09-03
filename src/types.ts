export type Sport =
  | 'basketball'
  | 'rugby'
  | 'racing'
  | 'handcycling'
  | 'boccia'
  | 'swimming'
  | 'tennis'
  | 'other';

export type Condition = 'new' | 'like-new' | 'good' | 'fair';

export type Currency = 'GBP' | 'USD' | 'EUR' | 'AUD' | 'CAD';

export interface Measurement {
  label: string;
  value: string;
}

export interface Seller {
  id: string;
  name: string;
  verified: boolean;
  club?: string;
  rating: number;
  salesCount: number;
  memberSince: string;
  payoutsEnabled?: boolean;
}

// Structured, numeric spec fields — additive to the freeform `measurements`
// list. These are what let Browse actually filter/match by fit, rather than
// relying on a human reading a text description.
export interface StructuredSpec {
  seatWidthCm?: number;
  seatDepthCm?: number;
  weightCapacityKg?: number;
  minUserHeightCm?: number;
  maxUserHeightCm?: number;
  minUserWeightKg?: number;
  maxUserWeightKg?: number;
}

export interface Listing extends StructuredSpec {
  id: string;
  title: string;
  sport: Sport;
  category: string;
  condition: Condition;
  price: number | null;
  currency: Currency;
  description: string;
  measurements: Measurement[];
  location: string;
  country: string;
  shipsInternationally: boolean;
  seller: Seller;
  postedAt: string;
  featured?: boolean;
  photos?: string[];
  feeStatus?: 'exempt' | 'pending' | 'paid';
  soldAt?: string | null;
}

export interface WantedPost extends StructuredSpec {
  id: string;
  title: string;
  sport: Sport;
  category: string;
  description: string;
  maxPrice: number | null;
  currency: Currency;
  country: string;
  openToInternational: boolean;
  status: 'open' | 'fulfilled';
  buyer: Seller;
  createdAt: string;
}

export interface FitProfile {
  primarySport: Sport | null;
  disabilityNotes: string;
  classification: string;
  heightCm: number | null;
  weightKg: number | null;
  seatWidthCm: number | null;
  seatDepthCm: number | null;
  inseamCm: number | null;
  notes: string;
}

export const COUNTRIES = [
  'United Kingdom',
  'United States',
  'Canada',
  'Australia',
  'Netherlands',
  'Ireland',
] as const;

export const SPORTS: { id: Sport; label: string }[] = [
  { id: 'basketball', label: 'Wheelchair basketball' },
  { id: 'rugby', label: 'Wheelchair rugby' },
  { id: 'racing', label: 'Athletics & racing' },
  { id: 'handcycling', label: 'Handcycling' },
  { id: 'boccia', label: 'Boccia' },
  { id: 'swimming', label: 'Para-swimming' },
  { id: 'tennis', label: 'Wheelchair tennis' },
  { id: 'other', label: 'Other adaptive kit' },
];

export const CONDITIONS: { id: Condition; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'like-new', label: 'Like new' },
  { id: 'good', label: 'Good' },
  { id: 'fair', label: 'Fair' },
];
