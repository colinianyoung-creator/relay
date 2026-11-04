import { Link } from 'react-router-dom';
import { useFeedback } from '@/lib/feedbackContext';

export function Footer() {
  const { openFeedback } = useFeedback();
  return (
    <footer className="border-t border-[var(--color-line)] py-8 sm:py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-center text-sm text-[var(--color-ink-soft)] sm:flex-row sm:justify-between sm:text-left">
        <Link to="/" className="flex items-center gap-2 text-left hover:text-[var(--color-ink)]">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-dark)] font-display text-xs text-white">
            R
          </span>
          <span>Relay — adaptive sports equipment, matched by fit.</span>
        </Link>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          <Link to="/how-it-works" className="hover:text-[var(--color-ink)]">
            How it works
          </Link>
          <Link to="/terms" className="hover:text-[var(--color-ink)]">
            Terms
          </Link>
          <Link to="/faq" className="hover:text-[var(--color-ink)]">
            FAQ
          </Link>
          <Link to="/privacy" className="hover:text-[var(--color-ink)]">
            Privacy
          </Link>
          <button type="button" onClick={openFeedback} className="hover:text-[var(--color-ink)]">
            Send feedback
          </button>
        </div>
      </div>
    </footer>
  );
}
