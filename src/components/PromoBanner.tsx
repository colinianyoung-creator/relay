import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { fetchPromoRedemptionCount, LAUNCH_PROMO_CODE, LAUNCH_PROMO_CAP } from '@/lib/supabaseData';

const DISMISS_KEY = 'relay-promo-banner-dismissed';

/** Site-wide launch-promo banner: "first 100 sellers list free". Hides itself once the promo is fully claimed or the viewer's dismissed it. */
export function PromoBanner() {
  const [claimed, setClaimed] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    fetchPromoRedemptionCount(LAUNCH_PROMO_CODE)
      .then(setClaimed)
      .catch(() => setClaimed(null));
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Private browsing or blocked storage — dismissal just won't persist across reloads.
    }
  }

  if (dismissed || claimed === null || claimed >= LAUNCH_PROMO_CAP) return null;
  const remaining = LAUNCH_PROMO_CAP - claimed;

  return (
    <div className="bg-[var(--color-ink)] text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-6 py-2.5 text-sm">
        <p className="text-center">
          <span className="font-medium">First 100 sellers list free</span> — use code{' '}
          <span className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-xs tracking-wide">
            {LAUNCH_PROMO_CODE}
          </span>{' '}
          at posting.{' '}
          <span className="text-white/70">
            {remaining} of {LAUNCH_PROMO_CAP} left.
          </span>
        </p>
        <Link
          to="/sell"
          className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--color-ink)] hover:bg-white/90"
        >
          Sell equipment
        </Link>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-white/60 hover:text-white"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
