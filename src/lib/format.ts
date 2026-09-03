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

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = new Date('2026-09-01').getTime();
  const days = Math.round((now - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 14) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}
