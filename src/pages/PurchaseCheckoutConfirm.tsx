import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, AlertTriangle, Star } from 'lucide-react';
import { fetchListing, fetchCompletedOrder, createReview, type CompletedOrder } from '@/lib/supabaseData';
import { useAuth } from '@/lib/auth';
import type { Listing } from '@/types';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30_000;

function ReviewForm({ order, sellerName }: { order: CompletedOrder; sellerName: string }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <p className="mt-10 text-sm text-[var(--color-moss)]">Thanks for the review!</p>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || rating === 0) return;
    setError(null);
    setSubmitting(true);
    try {
      await createReview(order.id, order.listingId, user.id, order.sellerId, rating, comment);
      setSubmitted(true);
    } catch {
      setError("Couldn't submit your review — try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-10 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6 text-left"
    >
      <h2 className="text-lg">How was buying from {sellerName.split(' ')[0]}?</h2>
      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
          >
            <Star
              size={26}
              className={
                n <= (hoverRating || rating)
                  ? 'fill-[var(--color-brand)] text-[var(--color-brand)]'
                  : 'text-[var(--color-line)]'
              }
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything worth telling other buyers? (optional)"
        rows={3}
        className="mt-4 w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-sm outline-none focus:border-[var(--color-ink-soft)]"
      />
      {error && <p className="mt-2 text-sm text-[var(--color-brand-dark)]">{error}</p>}
      <button
        type="submit"
        disabled={rating === 0 || submitting}
        className="mt-3 flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
      >
        {submitting && <Loader2 size={15} className="animate-spin" />}
        Submit review
      </button>
    </form>
  );
}

export function PurchaseCheckoutConfirm() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const listingId = searchParams.get('listing_id');
  const [listing, setListing] = useState<Listing | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [order, setOrder] = useState<CompletedOrder | null>(null);

  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      const current = await fetchListing(listingId!);
      if (cancelled) return;
      if (current?.soldAt) {
        setListing(current);
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

  useEffect(() => {
    if (!listing || !user) return;
    fetchCompletedOrder(listing.id, user.id).then(setOrder);
  }, [listing, user]);

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
          order will show up shortly — check your account in a minute or two.
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
      <h1 className="text-3xl">Payment received — it's yours</h1>
      <p className="mt-3 text-[var(--color-ink-soft)]">
        You've bought "{listing.title}" from {listing.seller.name}. They'll be in touch to sort
        out collection or delivery.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          to={`/listing/${listing.id}`}
          className="inline-flex rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
        >
          View listing
        </Link>
        <Link
          to="/"
          className="inline-flex rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
        >
          Back to browse
        </Link>
      </div>

      {order && !order.alreadyReviewed && <ReviewForm order={order} sellerName={listing.seller.name} />}
    </div>
  );
}
