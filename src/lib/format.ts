import type { Currency } from '@/types';

const LOCALE_BY_CURRENCY: Record<Currency, string> = {
  GBP: 'en-GB',
  USD: 'en-US',
  EUR: 'en-IE',
  AUD: 'en-AU',
  CAD: 'en-CA',
};

export function formatPrice(price: number | null, currency: Currency = 'GBP'): string {
  if (price === null) return 'Free';
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

const COUNTRY_CODE: Record<string, string> = {
  'United Kingdom': 'UK',
  'United States': 'US',
  Canada: 'CA',
  Australia: 'AU',
  Netherlands: 'NL',
  Ireland: 'IE',
};

export function countryCode(country: string): string {
  return COUNTRY_CODE[country] ?? country;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(iso: string): string {
  // Every caller of this feeds it date-level granularity — either an actual
  // `date` column (posted_at) or a timestamptz manually truncated with
  // .slice(0, 10) — so both sides of the diff are normalized to UTC
  // calendar-day boundaries here too. Diffing the date's UTC-midnight
  // instant against the exact current instant (as this used to) made "days
  // ago" swing on what time of day "now" happens to be: anything posted
  // after roughly midday UTC would round up to "1 day ago" within seconds
  // of being created.
  const then = new Date(iso.slice(0, 10) + 'T00:00:00Z').getTime();
  const now = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
  const days = Math.round((now - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 14) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}
