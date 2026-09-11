import { useState } from 'react';
import { CircleDollarSign, Loader2 } from 'lucide-react';
import { respondToRefundRequest, type MyOrder } from '@/lib/supabaseData';
import { RequestRefundModal } from './RequestRefundModal';

/**
 * Buyer requests, seller approves/declines — approval is what actually calls
 * Stripe (see respond-refund-request), since an unconditional buyer-triggered
 * refund risks pushing an already-paid-out seller's Connect balance negative.
 */
export function RefundPanel({
  order,
  viewRole,
  onChanged,
}: {
  order: MyOrder;
  viewRole: 'buyer' | 'seller';
  onChanged: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nothing to request or show yet, and not the buyer — nothing to render.
  if (!order.refundRequestId && viewRole !== 'buyer') return null;
  // Buyer hasn't requested one, and the order is no longer paid (so there's
  // nothing left to request a refund on) — nothing to render.
  if (!order.refundRequestId && order.status !== 'paid') return null;

  async function handleDecline() {
    setError(null);
    setBusy(true);
    try {
      await respondToRefundRequest(order.refundRequestId!, 'decline', note);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decline that request.');
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    setError(null);
    setBusy(true);
    try {
      await respondToRefundRequest(order.refundRequestId!, 'approve');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve that request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col-span-full border-t border-[var(--color-line)] pt-3">
      <p className="mb-1.5 flex items-center gap-1.5 font-medium text-[var(--color-ink)]">
        <CircleDollarSign size={13} /> Refund
      </p>

      {error && <p className="mb-2 text-[var(--color-brand-dark)]">{error}</p>}

      {!order.refundRequestId && (
        <button
          onClick={() => setShowModal(true)}
          className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
        >
          Request a refund
        </button>
      )}

      {order.refundRequestId && order.refundStatus === 'pending' && (
        <div>
          <p>
            {order.refundReason}
            {order.refundDetails && ` — ${order.refundDetails}`}
          </p>
          {viewRole === 'seller' ? (
            declining ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note for the buyer"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDecline}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
                  >
                    {busy && <Loader2 size={12} className="animate-spin" />}
                    Confirm decline
                  </button>
                  <button
                    onClick={() => setDeclining(false)}
                    className="text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
                >
                  {busy && <Loader2 size={12} className="animate-spin" />}
                  Approve
                </button>
                <button
                  onClick={() => setDeclining(true)}
                  disabled={busy}
                  className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-60"
                >
                  Decline
                </button>
              </div>
            )
          ) : (
            <p className="mt-1 text-[var(--color-ink-soft)]">Awaiting a response from the seller.</p>
          )}
        </div>
      )}

      {order.refundRequestId && order.refundStatus === 'declined' && (
        <p>
          Declined.
          {order.refundSellerResponse && ` ${order.refundSellerResponse}`}
        </p>
      )}

      {order.refundRequestId && order.refundStatus === 'refunded' && (
        <p className="text-[var(--color-moss)]">Refunded.</p>
      )}

      {order.refundRequestId && order.refundStatus === 'failed' && (
        <p>
          Approved, but the refund couldn't be processed automatically — Relay's team will
          follow up to sort it out manually.
        </p>
      )}

      {showModal && (
        <RequestRefundModal
          orderId={order.id}
          onClose={() => setShowModal(false)}
          onSubmitted={onChanged}
        />
      )}
    </div>
  );
}
