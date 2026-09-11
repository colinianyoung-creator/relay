// No geo data exists anywhere in this app — location is a freeform town
// string and country is a 6-value enum. This is a deliberately coarse
// same-town/same-country heuristic, not real distance, so it's cheap to
// ship without geocoding. Good enough to nudge; a real postcode/lat-lng
// distance calc is a clearly separate follow-up if this proves useful.

export type DeliverySuggestion = 'same-town' | 'same-country' | 'different-country' | 'unknown';

export interface MyArea {
  country: string;
  town: string;
}

const MY_AREA_KEY = 'relay:my-area';

export function loadMyArea(): MyArea | null {
  try {
    const raw = localStorage.getItem(MY_AREA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.country === 'string' && typeof parsed?.town === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveMyArea(area: MyArea): void {
  try {
    localStorage.setItem(MY_AREA_KEY, JSON.stringify(area));
  } catch {
    // Ignore — this is a convenience prompt, not something worth failing over.
  }
}

/** Marks the prompt as dismissed without saving an area, so it doesn't nag again. */
export function skipMyArea(): void {
  saveMyArea({ country: '', town: '' });
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export function suggestDelivery(
  myArea: MyArea | null,
  listing: { country: string; location: string },
): DeliverySuggestion {
  if (!myArea || !myArea.country) return 'unknown';
  if (myArea.country !== listing.country) return 'different-country';
  if (myArea.town) {
    const a = normalize(myArea.town);
    const b = normalize(listing.location);
    if (a === b || a.includes(b) || b.includes(a)) return 'same-town';
  }
  return 'same-country';
}
