import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Clock, MapPin, Search, X } from 'lucide-react';
import { clearRecent, loadRecent, normalize, saveRecent, type Suggestion } from '@/lib/search';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  /** Already ranked for the current value; pass [] for a plain filter box. */
  suggestions?: Suggestion[];
  placeholder: string;
  /** Accessible name — the placeholder alone isn't one. */
  label: string;
  /** Enables the "recent searches" list under this localStorage key. */
  recentKey?: string;
  className?: string;
  /** pill = hero search; chip = compact filter-row control; field = form input. */
  variant?: 'pill' | 'chip' | 'field';
  /** Leading icon; the search glass unless this is a place field. */
  icon?: 'search' | 'place';
  id?: string;
  required?: boolean;
  /** Shown as a spinner-less "Searching…" hint while suggestions load. */
  loading?: boolean;
}

const WRAPPER: Record<NonNullable<SearchBoxProps['variant']>, string> = {
  pill: 'gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-2.5 shadow-sm',
  chip: 'gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3.5 py-1.5',
  field:
    'gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 focus-within:border-[var(--color-ink-soft)]',
};

function Highlighted({ text, query }: { text: string; query: string }) {
  const words = normalize(query).split(' ').filter(Boolean);
  if (words.length === 0) return <>{text}</>;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-transparent font-semibold text-[var(--color-ink)]">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function SearchBox({
  value,
  onChange,
  suggestions = [],
  placeholder,
  label,
  recentKey,
  className = '',
  variant = 'pill',
  icon = 'search',
  id,
  required,
  loading = false,
}: SearchBoxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>(() => (recentKey ? loadRecent(recentKey) : []));

  const showingRecent = !value.trim() && recent.length > 0;
  const options: Suggestion[] = useMemo(
    () => (showingRecent ? recent.map((label) => ({ label, hint: 'Recent' })) : suggestions),
    [showingRecent, recent, suggestions],
  );
  const expanded = open && options.length > 0;

  // New suggestions mean the old highlighted row no longer exists.
  useEffect(() => setActive(-1), [options]);

  function commit(term: string) {
    onChange(term);
    if (recentKey) setRecent(saveRecent(recentKey, term));
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!expanded) return setOpen(true);
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!expanded) return setOpen(true);
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (expanded && active >= 0) {
        e.preventDefault();
        commit(options[active].label);
      } else {
        if (recentKey) setRecent(saveRecent(recentKey, value));
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      if (expanded) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (value) {
        onChange('');
      }
    }
  }

  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <div className={`relative ${className}`}>
      <div className={`flex items-center ${WRAPPER[variant]}`}>
        {icon === 'place' ? (
          <MapPin size={variant === 'pill' ? 18 : 15} aria-hidden="true" className="shrink-0 text-[var(--color-ink-soft)]" />
        ) : (
          <Search size={variant === 'pill' ? 18 : 15} aria-hidden="true" className="shrink-0 text-[var(--color-ink-soft)]" />
        )}
        <input
          ref={inputRef}
          id={id}
          required={required}
          type="text"
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            if (recentKey && value.trim()) setRecent(saveRecent(recentKey, value));
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-ink-soft)]/70"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            // Keep focus in the field so the box doesn't close and reopen.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            className="shrink-0 rounded-full p-0.5 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label={showingRecent ? 'Recent searches' : 'Suggestions'}
        hidden={!expanded}
        className="absolute left-0 right-0 top-full z-30 mt-2 min-w-[18rem] max-h-80 overflow-y-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] py-1.5 shadow-[0_16px_40px_-16px_rgba(27,26,23,0.3)]"
      >
        {expanded &&
          options.map((o, i) => (
            <li
              key={`${o.label}-${i}`}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              // mousedown (not click) so the input's blur doesn't close the list first.
              onMouseDown={(e) => {
                e.preventDefault();
                commit(o.label);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm text-[var(--color-ink-soft)] ${
                i === active ? 'bg-[var(--color-line)]/50 text-[var(--color-ink)]' : ''
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {showingRecent ? (
                  <Clock size={14} aria-hidden="true" className="shrink-0" />
                ) : (
                  <Search size={14} aria-hidden="true" className="shrink-0" />
                )}
                <span className="truncate">
                  <Highlighted text={o.label} query={value} />
                </span>
              </span>
              {o.hint && <span className="shrink-0 text-xs">{o.hint}</span>}
            </li>
          ))}
        {expanded && showingRecent && recentKey && (
          <li role="presentation" className="px-4 pb-1 pt-1.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                clearRecent(recentKey);
                setRecent([]);
              }}
              className="text-xs text-[var(--color-ink-soft)] underline hover:text-[var(--color-ink)]"
            >
              Clear recent searches
            </button>
          </li>
        )}
      </ul>

      <p className="sr-only" aria-live="polite">
        {loading && !expanded
          ? 'Searching…'
          : expanded
          ? `${options.length} ${showingRecent ? 'recent search' : 'suggestion'}${options.length === 1 ? '' : 's'} available. Use up and down arrows to review.`
          : ''}
      </p>
    </div>
  );
}
