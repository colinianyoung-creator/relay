import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, ChevronRight } from 'lucide-react';
import { countActionItems, type ActionItem } from '@/lib/actionItems';

const COLLAPSED_COUNT = 5;

const rowClass =
  'flex w-full items-center justify-between gap-3 rounded-xl bg-[var(--color-paper-raised)] px-3.5 py-3 text-left hover:bg-white';

/**
 * Everything currently waiting on the signed-in user, at the top of their
 * account. Items come from the live state of their orders, offers and
 * messages (see lib/actionItems.ts), so a row disappears as soon as it's dealt with.
 */
export function ActionRequiredPanel({
  items,
  onSelect,
}: {
  items: ActionItem[];
  onSelect: (item: ActionItem) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  if (items.length === 0) return null;

  const total = countActionItems(items);
  const shown = showAll ? items : items.slice(0, COLLAPSED_COUNT);
  const hiddenCount = items.length - shown.length;

  return (
    <section
      aria-labelledby="action-required-heading"
      className="mt-6 rounded-2xl border-2 border-[var(--color-brand)] bg-[var(--color-brand-soft)] p-4"
    >
      <h2 id="action-required-heading" className="flex items-center gap-2 text-base text-[var(--color-brand-dark)]">
        <BellRing size={18} aria-hidden="true" />
        Needs your attention
        <span className="rounded-full bg-[var(--color-brand-dark)] px-2 py-0.5 text-xs font-semibold text-white">
          {total}
        </span>
      </h2>

      {/* Always mounted, so a screen reader announces it when the number changes. */}
      <p className="sr-only" aria-live="polite">
        {total === 1 ? '1 thing needs' : `${total} things need`} your attention
      </p>

      <ul className="mt-3 space-y-2">
        {shown.map((item) => (
          <li key={item.id}>
            {item.to ? (
              <Link to={item.to} className={rowClass}>
                <RowText item={item} />
              </Link>
            ) : (
              <button type="button" onClick={() => onSelect(item)} className={rowClass}>
                <RowText item={item} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 text-sm font-medium text-[var(--color-brand-dark)] hover:underline"
        >
          Show {hiddenCount} more
        </button>
      )}
    </section>
  );
}

function RowText({ item }: { item: ActionItem }) {
  return (
    <>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--color-ink)]">{item.title}</span>
        <span className="mt-0.5 line-clamp-2 text-xs text-[var(--color-ink-soft)]">{item.detail}</span>
      </span>
      <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-[var(--color-ink-soft)]" />
    </>
  );
}
