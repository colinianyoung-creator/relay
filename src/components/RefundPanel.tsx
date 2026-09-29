import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CircleDollarSign, Loader2, MapPin, PackageCheck, Printer } from 'lucide-react';
import {
  escalateRefundRequest,
  respondToRefundRequest,
  requestReturn,
  markReturnShipped,
  confirmReturnReceived,
  fetchReturnHandoverToken,
  type MyOrder,
  type ReturnAddress,
} from '@/lib/supabaseData';
import { RequestRefundModal } from './RequestRefundModal';
import { formatPrice } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { OrderStatusTracker } from './OrderStatusTracker';
import { Badge } from './Badge';

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
  const [returnQr, setReturnQr] = useState<{ dataUrl: string; scanUrl: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const labelPrintId = `return-label-${order.id}`;

  // Buyer needs a printable code for the parcel, same as the seller does on
  // the outbound leg — build it as soon as a return's been requested and
  // hasn't shipped yet (RLS lets the buyer read the token straight off
  // order_returns; see fetchReturnHandoverToken).
  useEffect(() => {
    if (viewRole !== 'buyer' || !order.returnRequested || order.returnShippedAt || order.returnReceivedAt) {
      setReturnQr(null);
      return;
    }
    let cancelled = false;
    fetchReturnHandoverToken(order.id)
      .then(async (result) => {
        if (!result || cancelled) return;
        const scanUrl = `${window.location.origin}/scan/${result.token}`;
        const dataUrl = await QRCode.toDataURL(scanUrl, { width: 220, margin: 1 });
        if (!cancelled) setReturnQr({ dataUrl, scanUrl });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [viewRole, order.id, order.returnRequested, order.returnShippedAt, order.returnReceivedAt]);

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
  // A return is required before approving unless there was nothing to send
  // back in the first place — enforced again server-side in
  // respond-refund-request, so this is a UI convenience, not the only guard.
  const returnRequired = order.refundReason !== 'Item never arrived/collected';
  const canApprove = !returnRequired || !!order.returnReceivedAt;

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
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{order.refundReason}</Badge>
            {order.refundDetails && (
              <span className="text-xs text-[var(--color-ink-soft)]">"{order.refundDetails}"</span>
            )}
          </div>

          {order.returnRequested && (
            <div className="mt-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
              <p className="mb-2.5 flex items-center gap-1.5 font-medium text-[var(--color-ink)]">
                <PackageCheck size={13} /> Return
              </p>
              <OrderStatusTracker
                steps={[
                  { label: 'Requested', timestamp: order.refundRequestedAt },
                  { label: 'Sent back', timestamp: order.returnShippedAt },
                  { label: 'Received', timestamp: order.returnReceivedAt },
                ]}
              />
              {returnErr && <p className="mt-2 text-[var(--color-brand-dark)]">{returnErr}</p>}
              {order.returnReceivedAt ? (
                viewRole === 'buyer' && (
                  <p className="mt-2 text-[var(--color-ink-soft)]">The seller can now issue your refund.</p>
                )
              ) : order.returnShippedAt ? (
                viewRole === 'seller' && (
                  <button
                    onClick={handleConfirmReturnReceived}
                    disabled={returnBusy}
                    className="mt-2 flex items-center gap-1.5 rounded-full bg-[var(--color-moss)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {returnBusy && <Loader2 size={12} className="animate-spin" />}
                    Confirm received
                  </button>
                )
              ) : viewRole === 'buyer' ? (
                <>
                  <div className="mt-2 flex items-start gap-2 rounded-lg bg-[var(--color-paper)] p-2.5">
                    <MapPin size={14} className="mt-0.5 shrink-0 text-[var(--color-ink-soft)]" />
                    <div className="text-[var(--color-ink-soft)]">
                      <p className="font-medium text-[var(--color-ink)]">{order.returnRecipientName}</p>
                      <p>{order.returnAddress?.line1}</p>
                      {order.returnAddress?.line2 && <p>{order.returnAddress.line2}</p>}
                      <p>
                        {[order.returnAddress?.city, order.returnAddress?.postal_code].filter(Boolean).join(', ')}
                      </p>
                      <p>{order.returnAddress?.country}</p>
                    </div>
                  </div>

                  {returnQr && (
                    <div className="mt-3 rounded-xl border border-[var(--color-line)] p-3">
                      <style>{`
                        @media print {
                          body * { visibility: hidden; }
                          #${labelPrintId}, #${labelPrintId} * { visibility: visible; }
                          #${labelPrintId} { position: fixed; inset: 0; padding: 32px; }
                        }
                      `}</style>
                      <div id={labelPrintId} className="mx-auto max-w-xs text-center">
                        <div className="mb-3 text-left">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
                            Return to
                          </p>
                          <div className="mt-1 text-sm leading-relaxed">
                            <p className="font-medium text-[var(--color-ink)]">{order.returnRecipientName}</p>
                            <p>{order.returnAddress?.line1}</p>
                            {order.returnAddress?.line2 && <p>{order.returnAddress.line2}</p>}
                            {order.returnAddress?.city && <p>{order.returnAddress.city}</p>}
                            <p>{order.returnAddress?.postal_code}</p>
                            <p>{order.returnAddress?.country}</p>
                          </div>
                        </div>
                        <img src={returnQr.dataUrl} alt="Return handover QR code" className="mx-auto h-40 w-40" />
                        <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
                          Return · {order.title} · Order {order.id.slice(0, 8)}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <button
                          onClick={() => window.print()}
                          className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
                        >
                          <Printer size={12} /> Print label
                        </button>
                        <a
                          href={returnQr.scanUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
                        >
                          Open link
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard
                              ?.writeText(returnQr.scanUrl)
                              .then(() => setLinkCopied(true))
                              .catch(() => setLinkCopied(false));
                          }}
                          className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
                        >
                          {linkCopied ? 'Copied' : 'Copy link'}
                        </button>
                      </div>
                      <p className="mt-2 text-center text-[10px] text-[var(--color-ink-soft)]">
                        Print this and stick it on the parcel, or scan it yourself when you post it.
                      </p>
                    </div>
                  )}

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
                <button
                  onClick={handleConfirmReturnReceived}
                  disabled={returnBusy}
                  title="You can confirm this if it's already arrived, even before the buyer marks it sent"
                  className="mt-2 flex items-center gap-1.5 rounded-full bg-[var(--color-moss)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  {returnBusy && <Loader2 size={12} className="animate-spin" />}
                  Confirm received
                </button>
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
              <form onSubmit={handleRequestReturn} className="mt-2 space-y-2.5 rounded-lg bg-[var(--color-paper-raised)] p-3">
                <p className="mb-1 flex items-center gap-1.5 font-medium text-[var(--color-ink)]">
                  <MapPin size={13} /> Where should it be sent back to?
                </p>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
                    Recipient name
                  </span>
                  <input
                    required
                    value={returnRecipientName}
                    onChange={(e) => setReturnRecipientName(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
                    Address line 1
                  </span>
                  <input
                    required
                    value={returnAddr.line1}
                    onChange={(e) => setReturnAddr((a) => ({ ...a, line1: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
                    Address line 2 (optional)
                  </span>
                  <input
                    value={returnAddr.line2 ?? ''}
                    onChange={(e) => setReturnAddr((a) => ({ ...a, line2: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
                  />
                </label>
                <div className="flex gap-2">
                  <label className="block flex-1">
                    <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
                      Town/city
                    </span>
                    <input
                      value={returnAddr.city ?? ''}
                      onChange={(e) => setReturnAddr((a) => ({ ...a, city: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
                    />
                  </label>
                  <label className="block flex-1">
                    <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
                      Postcode
                    </span>
                    <input
                      required
                      value={returnAddr.postal_code}
                      onChange={(e) => setReturnAddr((a) => ({ ...a, postal_code: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
                    Country (e.g. GB)
                  </span>
                  <input
                    required
                    value={returnAddr.country}
                    onChange={(e) => setReturnAddr((a) => ({ ...a, country: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
                  />
                </label>
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
                {returnRequired && !order.returnRequested && (
                  <button
                    onClick={() => setRequestingReturn(true)}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
                  >
                    Ask buyer to return it first
                  </button>
                )}
                {canApprove && (
                  <button
                    onClick={() => setApproving(true)}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
                  >
                    Approve refund
                  </button>
                )}
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
          <Badge tone="brand">Declined</Badge>
          {order.refundSellerResponse && (
            <p className="mt-1.5 text-[var(--color-ink-soft)]">{order.refundSellerResponse}</p>
          )}
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
        <div>
          <Badge>Escalated to Relay</Badge>
          <p className="mt-1.5 text-[var(--color-ink-soft)]">They'll review and follow up.</p>
        </div>
      )}

      {order.refundRequestId && order.refundStatus === 'dismissed' && (
        <div>
          <Badge>Not refunded</Badge>
          {order.refundAdminNote && <p className="mt-1.5 text-[var(--color-ink-soft)]">{order.refundAdminNote}</p>}
        </div>
      )}

      {order.refundRequestId && order.refundStatus === 'refunded' && (
        <Badge tone="moss">
          <CircleDollarSign size={12} /> Refunded
        </Badge>
      )}

      {order.refundRequestId && order.refundStatus === 'failed' && (
        <div>
          <Badge tone="brand">Needs manual follow-up</Badge>
          <p className="mt-1.5 text-[var(--color-ink-soft)]">
            Approved, but the refund couldn't be processed automatically — Relay's team will follow up to
            sort it out manually.
          </p>
        </div>
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
