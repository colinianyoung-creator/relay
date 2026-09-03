import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Search, AlertTriangle } from 'lucide-react';
import { fetchListing, fetchMatchingWantedPosts } from '@/lib/supabaseData';
import { Badge } from '@/components/Badge';
import { formatPrice, timeAgo } from '@/lib/format';
import type { WantedPost, Listing } from '@/types';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30_000;

export function ListingCheckoutConfirm() {
  const [searchParams] = useSearchParams();
  const listingId = searchParams.get('listing_id');
  const [listing, setListing] = useState<Listing | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [matches, setMatches] = useState<WantedPost[] | null>(null);

  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      const current = await fetchListing(listingId!);
      if (cancelled) return;
      if (current?.feeStatus === 'paid') {
        setListing(current);
        fetchMatchingWantedPosts(current).then(setMatches);
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
  }, [listingId]);

  if (!listingId) {
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
          listing will appear shortly — check your account in a minute or two.
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

  if (!listing) {
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
      <h1 className="text-3xl">Payment received — listing published</h1>
      <p className="mt-3 text-[var(--color-ink-soft)]">
        "{listing.title}" is now live on Relay. We'll email you when someone gets in touch.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          to={`/listing/${listing.id}`}
          className="inline-flex rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
        >
          View your listing
        </Link>
        <Link
          to="/"
          className="inline-flex rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
        >
          Back to browse
        </Link>
      </div>

      {matches === null ? (
        <p className="mt-10 flex items-center justify-center gap-2 text-sm text-[var(--color-ink-soft)]">
          <Loader2 size={14} className="animate-spin" /> Checking the wanted board for matches…
        </p>
      ) : matches.length > 0 ? (
        <div className="mt-10 text-left">
          <h2 className="mb-3 flex items-center justify-center gap-2 text-center text-lg">
            <Search size={17} /> {matches.length} buyer{matches.length === 1 ? '' : 's'} on the
            wanted board might want this
          </h2>
          <div className="space-y-3">
            {matches.map((m) => (
              <Link
                key={m.id}
                to={`/wanted/${m.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4 hover:border-[var(--color-brand)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{m.title}</span>
                    <Badge>{m.category}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                    {m.maxPrice ? `Up to ${formatPrice(m.maxPrice, m.currency)}` : 'Any budget'} ·
                    posted {timeAgo(m.createdAt.slice(0, 10))}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-10 text-sm text-[var(--color-ink-soft)]">
          Nobody's posted a matching want yet — your listing's own page will show it if that
          changes.
        </p>
      )}
    </div>
  );
}
