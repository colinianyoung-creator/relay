import { useEffect, useState } from 'react';
import { BellRing, Loader2, X } from 'lucide-react';
import { fetchSavedSearches, deleteSavedSearch, type SavedSearch } from '@/lib/supabaseData';
import { formatPrice } from '@/lib/format';
import { SPORTS, CONDITIONS } from '@/types';

function summarize(search: SavedSearch): string {
  const parts: string[] = [];
  if (search.sport) parts.push(SPORTS.find((s) => s.id === search.sport)?.label ?? search.sport);
  if (search.condition) parts.push(CONDITIONS.find((c) => c.id === search.condition)?.label ?? search.condition);
  if (search.country) parts.push(search.country);
  if (search.freeOnly) parts.push('Free only');
  if (search.minPrice !== null || search.maxPrice !== null) {
    const min = search.minPrice !== null ? formatPrice(search.minPrice, 'GBP') : '';
    const max = search.maxPrice !== null ? formatPrice(search.maxPrice, 'GBP') : '';
    parts.push(min && max ? `${min}–${max}` : min ? `${min}+` : `Up to ${max}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Any listing';
}

/** New-listing email alerts for a saved filter combination — see check-saved-searches / stripe-webhook. */
export function SavedSearches({ userId }: { userId: string }) {
  const [searches, setSearches] = useState<SavedSearch[] | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSavedSearches(userId).then(setSearches);
  }, [userId]);

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      await deleteSavedSearch(id);
      setSearches((prev) => prev?.filter((s) => s.id !== id) ?? null);
    } finally {
      setRemovingId(null);
    }
  }

  if (searches === null) {
    return <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />;
  }
  if (searches.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink-soft)]">
        <BellRing size={14} /> Saved searches
      </h3>
      <div className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
        {searches.map((search) => (
          <div key={search.id} className="flex items-center justify-between gap-3 p-3.5">
            <p className="text-sm">{summarize(search)}</p>
            <button
              onClick={() => handleRemove(search.id)}
              disabled={removingId === search.id}
              aria-label="Remove saved search"
              className="shrink-0 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-60"
            >
              {removingId === search.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
