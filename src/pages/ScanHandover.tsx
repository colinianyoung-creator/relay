import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, AlertTriangle, PackageCheck } from 'lucide-react';
import {
  confirmHandover,
  lookupHandoverToken,
  updateDeliveryDetails,
  markReturnShipped,
  confirmReturnReceived,
  type HandoverLookup,
} from '@/lib/supabaseData';
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
  const [returning, setReturning] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [justReturnShipped, setJustReturnShipped] = useState(false);
  const [justReturnReceived, setJustReturnReceived] = useState(false);

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

  async function handleMarkReturnShipped() {
    if (!lookup) return;
    setReturnError(null);
    setReturning(true);
    try {
      await markReturnShipped(lookup.orderId, token);
      setJustReturnShipped(true);
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : 'Could not mark this as sent.');
    } finally {
      setReturning(false);
    }
  }

  async function handleConfirmReturnReceived() {
    if (!lookup) return;
    setReturnError(null);
    setReturning(true);
    try {
      await confirmReturnReceived(lookup.orderId, token);
      setJustReturnReceived(true);
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : 'Could not confirm this as received.');
    } finally {
      setReturning(false);
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
      <div className="mx-auto max-w-lg px-4 py-24 sm:px-6 text-center">
        <p className="text-[var(--color-ink-soft)]">This link is missing its code.</p>
        <Link to="/" className="mt-4 inline-block text-[var(--color-brand)] underline">
          Back to browse
        </Link>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 sm:px-6 text-center">
        <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 sm:px-6 text-center">
        <h1 className="text-2xl">Sign in to continue</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">Sign in to confirm this delivery.</p>
        <AuthModal onClose={() => {}} />
      </div>
    );
  }

  if (lookupError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 sm:px-6 text-center">
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
      <div className="mx-auto max-w-lg px-4 py-24 sm:px-6 text-center">
        <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" size={32} />
      </div>
    );
  }

  if (lookup.kind === 'return') {
    const addr = lookup.returnAddress;
    if (lookup.role === 'buyer') {
      if (lookup.receivedAt) {
        return (
          <div className="mx-auto max-w-lg px-4 py-24 sm:px-6 text-center">
            <CheckCircle2 className="mx-auto mb-4 text-[var(--color-moss)]" size={40} />
            <h1 className="text-2xl">Return received</h1>
            <p className="mt-3 text-[var(--color-ink-soft)]">
              {lookup.returnRecipientName.split(' ')[0]} has confirmed "{lookup.title}" arrived back with
              them. They'll issue your refund from here.
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
      if (lookup.shippedAt || justReturnShipped) {
        return (
          <div className="mx-auto max-w-lg px-4 py-24 sm:px-6 text-center">
            <PackageCheck className="mx-auto mb-4 text-[var(--color-ink-soft)]" size={36} />
            <h1 className="text-2xl">Return on its way</h1>
            <p className="mt-3 text-[var(--color-ink-soft)]">
              You've marked "{lookup.title}" as sent back. {lookup.returnRecipientName.split(' ')[0]} will
              confirm once it arrives, then issue your refund.
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
        <div className="mx-auto max-w-lg px-4 py-24 sm:px-6 text-center">
          <PackageCheck className="mx-auto mb-4 text-[var(--color-ink-soft)]" size={36} />
          <h1 className="text-2xl">Sending "{lookup.title}" back?</h1>
          <div className="mx-auto mt-4 max-w-xs rounded-xl bg-[var(--color-paper-raised)] p-4 text-left text-sm">
            <p className="text-xs text-[var(--color-ink-soft)]">Send to</p>
            <p className="mt-1 font-medium">{lookup.returnRecipientName}</p>
            <p>{addr.line1}</p>
            {addr.line2 && <p>{addr.line2}</p>}
            {addr.city && <p>{addr.city}</p>}
            <p>{addr.postal_code}</p>
            <p>{addr.country}</p>
          </div>
          <p className="mt-4 text-[var(--color-ink-soft)]">
            Scanning this at the point of posting lets {lookup.returnRecipientName.split(' ')[0]} know it's
            on its way back to them.
          </p>
          {returnError && <p className="mt-3 text-[var(--color-brand-dark)]">{returnError}</p>}
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={handleMarkReturnShipped}
              disabled={returning}
              className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
            >
              {returning && <Loader2 size={14} className="animate-spin" />}
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

    // role === 'seller' — this is the receiving end of the return.
    if (lookup.receivedAt || justReturnReceived) {
      return (
        <div className="mx-auto max-w-lg px-4 py-24 sm:px-6 text-center">
          <CheckCircle2 className="mx-auto mb-4 text-[var(--color-moss)]" size={40} />
          <h1 className="text-2xl">Return confirmed</h1>
          <p className="mt-3 text-[var(--color-ink-soft)]">
            You've confirmed "{lookup.title}" arrived back with you. Approve the refund from your Orders
            tab whenever you're ready.
          </p>
          <Link
            to="/account?tab=orders"
            className="mt-6 inline-flex rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
          >
            Go to Orders
          </Link>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-lg px-4 py-24 sm:px-6 text-center">
        <PackageCheck className="mx-auto mb-4 text-[var(--color-ink-soft)]" size={36} />
        <h1 className="text-2xl">Received "{lookup.title}" back?</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          {lookup.shippedAt
            ? 'The buyer has marked it as sent.'
            : "The buyer hasn't marked it as sent yet, but confirm here once it's physically arrived."}{' '}
          Confirming unlocks approving the refund — nothing is refunded automatically.
        </p>
        {returnError && <p className="mt-3 text-[var(--color-brand-dark)]">{returnError}</p>}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={handleConfirmReturnReceived}
            disabled={returning}
            className="flex items-center gap-1.5 rounded-full bg-[var(--color-moss)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {returning && <Loader2 size={14} className="animate-spin" />}
            Confirm received
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

  if (lookup.role === 'seller') {
    // Only courier/freight has a distinct "sent" step to mark — a
    // collection code's own handover *is* the buyer's scan, there's nothing
    // separate for the seller to confirm here.
    const canMarkSent = lookup.method === 'courier' || lookup.method === 'freight';
    if (canMarkSent && !lookup.settled && !lookup.shippedAt && !justMarkedShipped) {
      return (
        <div className="mx-auto max-w-lg px-4 py-24 sm:px-6 text-center">
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
      <div className="mx-auto max-w-lg px-4 py-24 sm:px-6 text-center">
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
      <div className="mx-auto max-w-lg px-4 py-24 sm:px-6 text-center">
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
      <div className="mx-auto max-w-lg px-4 py-24 sm:px-6 text-center">
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
    <div className="mx-auto max-w-lg px-4 py-24 sm:px-6 text-center">
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
