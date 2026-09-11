import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { fetchListing, fetchCompletedOrder, type CompletedOrder } from '@/lib/supabaseData';
import { useAuth } from '@/lib/auth';
import { ReviewForm as SharedReviewForm } from '@/components/ReviewForm';
import type { Listing } from '@/types';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30_000;

function ReviewForm({ order, sellerName }: { order: CompletedOrder; sellerName: string }) {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return <p className="mt-10 text-sm text-[var(--color-moss)]">Thanks for the review!</p>;
  }
  if (!user) return null;

  return (
    <SharedReviewForm
      orderId={order.id}
      listingId={order.listingId}
      reviewerId={user.id}
      sellerId={order.sellerId}
      sellerName={sellerName}
      onSubmitted={() => setSubmitted(true)}
    />
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
