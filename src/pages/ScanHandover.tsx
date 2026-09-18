import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, AlertTriangle, PackageCheck } from 'lucide-react';
import { confirmHandover, lookupHandoverToken, updateDeliveryDetails, type HandoverLookup } from '@/lib/supabaseData';
import { formatDateTime } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { AuthModal } from '@/components/AuthModal';

/**
 * Where the handover QR actually goes once printed on a parcel or shown on
 * screen — scanning it with any camera now opens this page instead of
 * landing nowhere. A buyer confirms receipt here (releasing the seller's
 * payout); a seller who opens their own code just sees its status.
 */
export function ScanHandover() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const [lookup, setLookup] = useState<HandoverLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [justMarkedShipped, setJustMarkedShipped] = useState(false);

  useEffect(() => {
    if (!token || !user) return;
    let cancelled = false;
    lookupHandoverToken(token)
      .then((result) => {
        if (!cancelled) setLookup(result);
      })
      .catch((err) => {
        if (!cancelled) setLookupError(err instanceof Error ? err.message : 'Could not look up this code.');
      });
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  async function handleMarkShipped() {
    if (!lookup) return;
    setMarkError(null);
    setMarking(true);
    try {
      await updateDeliveryDetails(lookup.orderId, { markShipped: true });
      setJustMarkedShipped(true);
    } catch (err) {
      setMarkError(err instanceof Error ? err.message : 'Could not mark this as shipped.');
    } finally {
      setMarking(false);
    }
  }

  async function handleConfirm() {
    if (!token || !lookup) return;
    setConfirmError(null);
    setConfirming(true);
    try {
      await confirmHandover(lookup.orderId, token);
      setJustConfirmed(true);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Could not confirm receipt.');
    } finally {
      setConfirming(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="text-[var(--color-ink-soft)]">This link is missing its code.</p>
        <Link to="/" className="mt-4 inline-block text-[var(--color-brand)] underline">
          Back to browse
        </Link>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-2xl">Sign in to continue</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">Sign in to confirm this delivery.</p>
        <AuthModal onClose={() => {}} />
      </div>
    );
  }

  if (lookupError) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <AlertTriangle className="mx-auto mb-4 text-[var(--color-brand)]" size={36} />
        <h1 className="text-2xl">Can't open this code</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">{lookupError}</p>
        <Link
          to="/account"
          className="mt-6 inline-flex rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
        >
          Go to my account
        </Link>
      </div>
    );
  }

  if (!lookup) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" size={32} />
      </div>
    );
  }

  if (lookup.role === 'seller') {
    // Not shipped yet — this is the seller scanning their own label at the
    // point of actually sending it, so that's the moment to mark it shipped
    // and let the buyer know, rather than a separate step back in the app.
    if (!lookup.settled && !lookup.shippedAt && !justMarkedShipped) {
      return (
        <div className="mx-auto max-w-lg px-6 py-24 text-center">
          <PackageCheck className="mx-auto mb-4 text-[var(--color-ink-soft)]" size={36} />
          <h1 className="text-2xl">Sending "{lookup.title}"?</h1>
          <p className="mt-3 text-[var(--color-ink-soft)]">
            Scanning this at the point of posting marks the order as shipped and lets the buyer
            know it's on its way.
          </p>
          {markError && <p className="mt-3 text-[var(--color-brand-dark)]">{markError}</p>}
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={handleMarkShipped}
              disabled={marking}
              className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
            >
              {marking && <Loader2 size={14} className="animate-spin" />}
              Mark as sent
            </button>
            <Link
              to="/account"
              className="inline-flex items-center rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
            >
              Not now
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <PackageCheck className="mx-auto mb-4 text-[var(--color-ink-soft)]" size={36} />
        <h1 className="text-2xl">{lookup.title}</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          {lookup.settled
            ? `The buyer confirmed receipt${lookup.receivedConfirmedAt ? ` on ${formatDateTime(lookup.receivedConfirmedAt)}` : ''} — your payout has been released.`
            : justMarkedShipped
              ? "Marked as sent — the buyer's been notified. You'll be paid out automatically once they confirm receipt."
              : "Waiting for the buyer to scan this. You'll be notified, and paid out automatically, once they do."}
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

  // role === 'buyer'
  if (justConfirmed || lookup.settled) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <CheckCircle2 className="mx-auto mb-4 text-[var(--color-moss)]" size={40} />
        <h1 className="text-3xl">Confirmed — thanks!</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          You've confirmed receipt of "{lookup.title}" and the seller has been paid out.
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

  if (lookup.expired) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <AlertTriangle className="mx-auto mb-4 text-[var(--color-brand)]" size={36} />
        <h1 className="text-2xl">This code has expired</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          Ask the seller to generate a new one, or confirm receipt from your account instead.
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

  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <PackageCheck className="mx-auto mb-4 text-[var(--color-ink-soft)]" size={36} />
      <h1 className="text-2xl">Confirm you've received this</h1>
      <p className="mt-3 text-[var(--color-ink-soft)]">
        Confirming "{lookup.title}" releases payment to the seller straight away. Only do this once
        the item has actually arrived.
      </p>
      {confirmError && <p className="mt-3 text-[var(--color-brand-dark)]">{confirmError}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="flex items-center gap-1.5 rounded-full bg-[var(--color-moss)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {confirming && <Loader2 size={14} className="animate-spin" />}
          Confirm & release payment
        </button>
        <Link
          to="/account"
          className="inline-flex items-center rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
        >
          Not now
        </Link>
      </div>
    </div>
  );
}
