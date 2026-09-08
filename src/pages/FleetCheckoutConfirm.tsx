import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { fetchBundle } from '@/lib/supabaseData';
import type { FleetBundle } from '@/types';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30_000;

export function FleetCheckoutConfirm() {
  const [searchParams] = useSearchParams();
  const bundleId = searchParams.get('bundle_id');
  const [bundle, setBundle] = useState<FleetBundle | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!bundleId) return;
    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      const current = await fetchBundle(bundleId!);
      if (cancelled) return;
      if (current?.status === 'active') {
        setBundle(current);
        return;
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }
    poll();

    return () => {
      cancelled = true;
    };
  }, [bundleId]);

  if (!bundleId) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="text-[var(--color-ink-soft)]">Nothing to confirm here.</p>
        <Link to="/" className="mt-4 inline-block text-[var(--color-brand)] underline">
          Back to browse
        </Link>
      </div>
    );
  }

  if (timedOut) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <AlertTriangle className="mx-auto mb-4 text-[var(--color-brand)]" size={36} />
        <h1 className="text-3xl">Still confirming payment</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          Stripe took longer than expected to confirm this one. If you completed checkout, your
          fleet will appear shortly — check your account in a minute or two.
        </p>
        <Link
          to="/account"
          className="mt-6 inline-flex rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
        >
          Go to my account
        </Link>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <Loader2 className="mx-auto mb-4 animate-spin text-[var(--color-ink-soft)]" size={32} />
        <h1 className="text-2xl">Confirming payment…</h1>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
          This usually takes a few seconds — don't close this tab.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <CheckCircle2 className="mx-auto mb-4 text-[var(--color-moss)]" size={40} />
      <h1 className="text-3xl">Payment received — fleet published</h1>
      <p className="mt-3 text-[var(--color-ink-soft)]">
        "{bundle.title}" and all {bundle.listings.length} items are now live on Relay. We'll email
        you when someone gets in touch.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          to={`/fleet/${bundle.id}`}
          className="inline-flex rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
        >
          View your fleet
        </Link>
        <Link
          to="/"
          className="inline-flex rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
        >
          Back to browse
        </Link>
      </div>
    </div>
  );
}
