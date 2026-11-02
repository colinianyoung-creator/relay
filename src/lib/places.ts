import { COUNTRIES } from '@/types';

export interface Place {
  /** What goes in the field, e.g. "Sheffield, England". */
  label: string;
  /** One of COUNTRIES. */
  country: string;
}

interface GeocodeResult {
  name: string;
  admin1?: string;
  country?: string;
}

// Open-Meteo's free geocoder: no key, CORS-enabled. Only the text typed in the
// field is sent, never anything about the user.
const ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';

/** Towns and cities in the countries Relay supports; [] on any failure so the field stays free text. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(
      `${ENDPOINT}?name=${encodeURIComponent(q)}&count=10&language=en&format=json`,
      { signal },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: GeocodeResult[] };
    const seen = new Set<string>();
    const places: Place[] = [];
    for (const r of data.results ?? []) {
      if (!r.country || !(COUNTRIES as readonly string[]).includes(r.country)) continue;
      // The region disambiguates (Sheffield, England vs Sheffield, Alabama);
      // skip it when it just repeats the name.
      const label = r.admin1 && r.admin1 !== r.name ? `${r.name}, ${r.admin1}` : r.name;
      const key = `${label}|${r.country}`;
      if (seen.has(key)) continue;
      seen.add(key);
      places.push({ label, country: r.country });
    }
    return places;
  } catch {
    return [];
  }
}
