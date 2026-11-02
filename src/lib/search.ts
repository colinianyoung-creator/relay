export interface Suggestion {
  label: string;
  /** Short context shown beside the label, e.g. "Sport" or "Handcycling". */
  hint?: string;
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Cheap plural folding so "chairs" finds "chair" and vice versa.
function stem(word: string): string {
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
}

export function queryTokens(query: string): string[] {
  return normalize(query).split(' ').filter(Boolean).map(stem);
}

// True when a and b differ by at most one insertion, deletion, substitution
// or swapped pair of neighbours.
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true; // substitution
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // swap
  }
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return long.slice(i + 1) === short.slice(i); // insertion / deletion
}

/**
 * 0 = no match. Every query token must match something in the text: a word
 * that starts with it scores highest, a match inside a word (3+ characters
 * only) scores lower. Word order doesn't matter, so "chair racing" finds
 * "Racing chair".
 */
export function matchScore(query: string, text: string): number {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return 0;
  const words = normalize(text).split(' ').filter(Boolean).map(stem);
  if (words.length === 0) return 0;

  let score = 0;
  for (const token of tokens) {
    let best = 0;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w === token) best = Math.max(best, 4);
      else if (w.startsWith(token)) best = Math.max(best, i === 0 ? 3.5 : 3);
      else if (token.length >= 3 && w.includes(token)) best = Math.max(best, 1);
      // Typo tolerance for longer words, checked against the word's start so
      // a half-typed word still counts ("refnd" ~ "refund").
      else if (token.length >= 4 && withinOneEdit(token, w.slice(0, token.length))) best = Math.max(best, 0.5);
      else if (token.length >= 4 && withinOneEdit(token, w)) best = Math.max(best, 0.5);
    }
    if (best === 0) return 0;
    score += best;
  }
  return score;
}

export function matches(query: string, ...texts: (string | null | undefined)[]): boolean {
  if (queryTokens(query).length === 0) return true;
  return matchScore(query, texts.filter(Boolean).join(' ')) > 0;
}

/** Best-matching distinct candidates first; shorter labels win ties. */
export function rankSuggestions(query: string, candidates: Suggestion[], limit = 8): Suggestion[] {
  const seen = new Set<string>();
  const scored: { s: Suggestion; score: number }[] = [];
  for (const s of candidates) {
    const key = normalize(s.label);
    if (!key || seen.has(key)) continue;
    const score = matchScore(query, s.label);
    if (score === 0) continue;
    // Don't offer a suggestion that is exactly what's already typed.
    if (key === normalize(query)) continue;
    seen.add(key);
    scored.push({ s, score });
  }
  scored.sort((a, b) => b.score - a.score || a.s.label.length - b.s.label.length);
  return scored.slice(0, limit).map((x) => x.s);
}

const RECENT_MAX = 5;

export function loadRecent(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function saveRecent(key: string, term: string): string[] {
  const clean = term.trim();
  if (clean.length < 2) return loadRecent(key);
  const next = [clean, ...loadRecent(key).filter((t) => normalize(t) !== normalize(clean))].slice(
    0,
    RECENT_MAX,
  );
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* storage unavailable (private window etc.) — recents just don't persist */
  }
  return next;
}

export function clearRecent(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
