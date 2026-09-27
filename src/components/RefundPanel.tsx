import { useState } from 'react';
import { CircleDollarSign, Loader2, PackageCheck } from 'lucide-react';
import {
  escalateRefundRequest,
  respondToRefundRequest,
  requestReturn,
  markReturnShipped,
  confirmReturnReceived,
  type MyOrder,
  type ReturnAddress,
} from '@/lib/supabaseData';
import { RequestRefundModal } from './RequestRefundModal';
import { formatPrice } from '@/lib/format';
import { formatDateTime } from '@/lib/format';
import { useAuth } from '@/lib/auth';

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
  const { profile } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [approving, setApproving] = useState(false);
  const [requestingReturn, setRequestingReturn] = useState(false);
  const [returnAddr, setReturnAddr] = useState<ReturnAddress>({ line1: '', city: '', postal_code: '', country: 'GB' });
  const [returnRecipientName, setReturnRecipientName] = useState(profile?.name ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnBusy, setReturnBusy] = useState(false);
  const [returnErr, setReturnErr] = useState<string | null>(null);

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

  async function handleEscalate() {
    setError(null);
    setBusy(true);
    try {
      await escalateRefundRequest(order.refundRequestId!);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not escalate that request.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestReturn(e: React.FormEvent) {
    e.preventDefault();
    setReturnErr(null);
    setReturnBusy(true);
    try {
      await requestReturn(order.id, returnAddr, returnRecipientName);
      setRequestingReturn(false);
      onChanged();
    } catch (err) {
      setReturnErr(err instanceof Error ? err.message : 'Could not set up the return.');
    } finally {
      setReturnBusy(false);
    }
  }

  async function handleMarkReturnShipped() {
    setReturnErr(null);
    setReturnBusy(true);
    try {
      await markReturnShipped(order.id);
      onChanged();
    } catch (err) {
      setReturnErr(err instanceof Error ? err.message : 'Could not mark this as sent.');
    } finally {
      setReturnBusy(false);
    }
  }

  async function handleConfirmReturnReceived() {
    setReturnErr(null);
    setReturnBusy(true);
    try {
      await confirmReturnReceived(order.id);
      onChanged();
    } catch (err) {
      setReturnErr(err instanceof Error ? err.message : 'Could not confirm the return.');
    } finally {
      setReturnBusy(false);
    }
  }

  const needsSellerAction = viewRole === 'seller' && order.refundStatus === 'pending';
  const refundable = formatPrice(order.amount, order.currency);
  const paidOut = order.transferStatus === 'released';

  return (
    <div
      className={
        needsSellerAction
          ? 'col-span-full rounded-xl border-2 border-[var(--color-brand)] bg-[var(--color-brand-soft)] p-4'
          : 'col-span-full border-t border-[var(--color-line)] pt-3'
      }
    >
      <p
        className={`mb-1.5 flex items-center gap-1.5 font-medium ${
          needsSellerAction ? 'text-sm text-[var(--color-brand-dark)]' : 'text-[var(--color-ink)]'
        }`}
      >
        <CircleDollarSign size={needsSellerAction ? 16 : 13} />
        {needsSellerAction ? `Action needed — refund requested (${refundable})` : 'Refund'}
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

          {order.returnRequested && (
            <div className="mt-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
              <p className="flex items-center gap-1.5 font-medium text-[var(--color-ink)]">
                <PackageCheck size={13} /> Return in progress
              </p>
              {returnErr && <p className="mt-1 text-[var(--color-brand-dark)]">{returnErr}</p>}
              {order.returnReceivedAt ? (
                <p className="mt-1 text-[var(--color-moss)]">
                  Received back {formatDateTime(order.returnReceivedAt)}
                  {viewRole === 'buyer' && " — the seller can now issue your refund."}
                </p>
              ) : order.returnShippedAt ? (
                <>
                  <p className="mt-1 text-[var(--color-ink-soft)]">
                    Marked as sent {formatDateTime(order.returnShippedAt)}
                    {viewRole === 'buyer' && " — waiting for the seller to confirm it's arrived."}
                  </p>
                  {viewRole === 'seller' && (
                    <button
                      onClick={handleConfirmReturnReceived}
                      disabled={returnBusy}
                      className="mt-2 flex items-center gap-1.5 rounded-full bg-[var(--color-moss)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {returnBusy && <Loader2 size={12} className="animate-spin" />}
                      Confirm received
                    </button>
                  )}
                </>
              ) : viewRole === 'buyer' ? (
                <>
                  <p className="mt-1 text-[var(--color-ink-soft)]">
                    Send it back to {order.returnRecipientName}: {order.returnAddress?.line1}
                    {order.returnAddress?.line2 ? `, ${order.returnAddress.line2}` : ''}
                    {order.returnAddress?.city ? `, ${order.returnAddress.city}` : ''}, {order.returnAddress?.postal_code},{' '}
                    {order.returnAddress?.country}
                  </p>
                  <button
                    onClick={handleMarkReturnShipped}
                    disabled={returnBusy}
                    className="mt-2 flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
                  >
                    {returnBusy && <Loader2 size={12} className="animate-spin" />}
                    Mark as sent
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-1 text-[var(--color-ink-soft)]">
                    Waiting for the buyer to send it back to you. You can still confirm it if it's already
                    arrived.
                  </p>
                  <button
                    onClick={handleConfirmReturnReceived}
                    disabled={returnBusy}
                    className="mt-2 flex items-center gap-1.5 rounded-full bg-[var(--color-moss)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {returnBusy && <Loader2 size={12} className="animate-spin" />}
                    Confirm received
                  </button>
                </>
              )}
            </div>
          )}

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
            ) : approving ? (
              <div className="mt-2 space-y-2 rounded-lg bg-[var(--color-paper-raised)] p-3">
                <p className="font-medium text-[var(--color-ink)]">
                  Refund {refundable} to {order.counterpartyName}?
                </p>
                <p className="text-[var(--color-ink-soft)]">
                  {paidOut
                    ? `You've already been paid for this order, so the payout will be taken back from your connected account and the full ${refundable} returned to the buyer.`
                    : `You haven't been paid for this order yet, so ${refundable} goes back to the buyer and no payout is sent.`}{' '}
                  This can't be undone.
                </p>
                {order.returnRequested && !order.returnReceivedAt && (
                  <p className="text-[var(--color-brand-dark)]">
                    Heads up: you asked for this to be returned first, and it hasn't been confirmed as
                    received yet.
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleApprove}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-full bg-[var(--color-brand)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60"
                  >
                    {busy && <Loader2 size={12} className="animate-spin" />}
                    Yes, refund {refundable}
                  </button>
                  <button
                    onClick={() => setApproving(false)}
                    disabled={busy}
                    className="text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : requestingReturn ? (
              <form onSubmit={handleRequestReturn} className="mt-2 space-y-2 rounded-lg bg-[var(--color-paper-raised)] p-3">
                <p className="font-medium text-[var(--color-ink)]">Where should it be sent back to?</p>
                <input
                  required
                  placeholder="Recipient name"
                  value={returnRecipientName}
                  onChange={(e) => setReturnRecipientName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
                />
                <input
                  required
                  placeholder="Address line 1"
                  value={returnAddr.line1}
                  onChange={(e) => setReturnAddr((a) => ({ ...a, line1: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
                />
                <input
                  placeholder="Address line 2 (optional)"
                  value={returnAddr.line2 ?? ''}
                  onChange={(e) => setReturnAddr((a) => ({ ...a, line2: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
                />
                <div className="flex gap-2">
                  <input
                    placeholder="Town/city"
                    value={returnAddr.city ?? ''}
                    onChange={(e) => setReturnAddr((a) => ({ ...a, city: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
                  />
                  <input
                    required
                    placeholder="Postcode"
                    value={returnAddr.postal_code}
                    onChange={(e) => setReturnAddr((a) => ({ ...a, postal_code: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
                  />
                </div>
                <input
                  required
                  placeholder="Country (e.g. GB)"
                  value={returnAddr.country}
                  onChange={(e) => setReturnAddr((a) => ({ ...a, country: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
                />
                {returnErr && <p className="text-[var(--color-brand-dark)]">{returnErr}</p>}
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={returnBusy}
                    className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
                  >
                    {returnBusy && <Loader2 size={12} className="animate-spin" />}
                    Send return instructions
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestingReturn(false)}
                    disabled={returnBusy}
                    className="text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {!order.returnRequested && (
                  <button
                    onClick={() => setRequestingReturn(true)}
                    disabled={busy}
                    className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-60"
                  >
                    Ask buyer to return it first
                  </button>
                )}
                <button
                  onClick={() => setApproving(true)}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
                >
                  Approve refund
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
        <div>
          <p>
            Declined.
            {order.refundSellerResponse && ` ${order.refundSellerResponse}`}
          </p>
          {viewRole === 'buyer' && (
            <button
              onClick={handleEscalate}
              disabled={busy}
              className="mt-2 flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-60"
            >
              {busy && <Loader2 size={12} className="animate-spin" />}
              Escalate to Relay
            </button>
          )}
        </div>
      )}

      {order.refundRequestId && order.refundStatus === 'escalated' && (
        <p>Escalated to Relay's team — they'll review and follow up.</p>
      )}

      {order.refundRequestId && order.refundStatus === 'dismissed' && (
        <p>
          Relay reviewed this and won't be issuing a refund.
          {order.refundAdminNote && ` ${order.refundAdminNote}`}
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
          title={order.title}
          amount={order.amount}
          currency={order.currency}
          onClose={() => setShowModal(false)}
          onSubmitted={onChanged}
        />
      )}
    </div>
  );
}
