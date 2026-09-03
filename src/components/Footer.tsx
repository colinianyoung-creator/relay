import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-line)] py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-center text-sm text-[var(--color-ink-soft)] sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand)] font-display text-xs text-white">
            R
          </span>
          <span>Relay — adaptive sports equipment, matched by fit.</span>
        </div>
        <div className="flex gap-5">
          <Link to="/how-it-works" className="hover:text-[var(--color-ink)]">
            How it works
          </Link>
          <Link to="/terms" className="hover:text-[var(--color-ink)]">
            Terms
          </Link>
          <Link to="/privacy" className="hover:text-[var(--color-ink)]">
            Privacy
          </Link>
          <span>Prototype — demo data only</span>
        </div>
      </div>
    </footer>
  );
}
