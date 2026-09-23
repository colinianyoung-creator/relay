import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, FileText, Loader2, Printer, QrCode, Truck, X } from 'lucide-react';
import {
  confirmReceipt,
  deleteDeliveryEvidence,
  generateHandoverCode,
  getDeliveryEvidenceUrl,
  requestShippingQuote,
  updateDeliveryDetails,
  uploadDeliveryEvidence,
  type MyOrder,
} from '@/lib/supabaseData';
import { formatDateTime } from '@/lib/format';

export const METHOD_LABEL: Record<string, string> = {
  collection: 'Local collection',
  courier: 'Courier / parcel',
  freight: 'Freight',
};

function EvidenceThumb({ orderId, path, onRemoved }: { orderId: string; path: string; onRemoved: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = !/\.pdf$/i.test(path);

  useEffect(() => {
    let cancelled = false;
    getDeliveryEvidenceUrl(path).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <div className="relative">
      <a href={url ?? undefined} target="_blank" rel="noreferrer" className="block">
        {isImage ? (
          <div
            className="h-14 w-14 rounded-lg border border-[var(--color-line)] bg-cover bg-center"
            style={url ? { backgroundImage: `url(${url})` } : undefined}
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-[var(--color-line)] text-[var(--color-ink-soft)]">
            <FileText size={18} />
          </div>
        )}
      </a>
      <button
        onClick={async () => {
          await deleteDeliveryEvidence(orderId, path);
          onRemoved();
        }}
        aria-label="Remove evidence"
        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-ink)] text-white"
      >
        <X size={10} />
      </button>
    </div>
  );
}

/**
 * Relay doesn't book carriers — this is a shared place for the buyer and
 * seller to ask for a quote (which nudges the other side via a message),
 * record whatever they actually arranged externally, and attach real proof
 * (a photo of a receipt or tracking label) rather than just a typed reference.
 */
export function DeliveryPanel({ order, onChanged }: { order: MyOrder; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState(order.deliveryMethod ?? '');
  const [trackingReference, setTrackingReference] = useState(order.trackingReference ?? '');
  const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl ?? '');
  const [notes, setNotes] = useState(order.deliveryNotes ?? '');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [handoverQr, setHandoverQr] = useState<{ dataUrl: string; expiresAt: string } | null>(null);

  async function handleRequestQuote() {
    setError(null);
    setBusy(true);
    try {
      await requestShippingQuote(order.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request a quote.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    setError(null);
    setBusy(true);
    try {
      await updateDeliveryDetails(order.id, {
        method: (method as 'collection' | 'courier' | 'freight') || undefined,
        trackingReference,
        trackingUrl,
        notes,
      });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save those details.');
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkShipped() {
    setError(null);
    setBusy(true);
    try {
      await updateDeliveryDetails(order.id, { markShipped: true });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark this as shipped.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmReceipt() {
    setError(null);
    setBusy(true);
    try {
      await confirmReceipt(order.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm receipt.');
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkDelivered() {
    setError(null);
    setBusy(true);
    try {
      await updateDeliveryDetails(order.id, { markDelivered: true });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark this as delivered.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateHandoverCode() {
    setError(null);
    setBusy(true);
    try {
      const { token, expiresAt } = await generateHandoverCode(order.id);
      const scanUrl = `${window.location.origin}/scan/${token}`;
      const dataUrl = await QRCode.toDataURL(scanUrl, { width: 220, margin: 1 });
      setHandoverQr({ dataUrl, expiresAt });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a handover code.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await uploadDeliveryEvidence(order.id, file);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that file.');
    } finally {
      setUploading(false);
    }
  }

  const hasArranged = Boolean(order.deliveryMethod || order.trackingReference || order.trackingUrl);
  // Details are what got agreed *before* dispatch. The one thing still worth
  // filling in afterwards is the tracking reference — "Mark as delivered"
  // is blocked without one — so a seller who shipped without it keeps the
  // button until they've added it.
  const canEditDetails =
    !order.shippedAt ||
    (order.role === 'seller' &&
      (order.deliveryMethod === 'courier' || order.deliveryMethod === 'freight') &&
      !order.trackingReference &&
      order.trackingStatus !== 'delivered');
  const isCollection = order.deliveryMethod === 'collection' || !order.deliveryMethod;
  // Scopes the print CSS below to this order's own label — this panel can
  // render more than once on one page (e.g. a seller's order list).
  const labelPrintId = `shipping-label-${order.id}`;

  return (
    <div className="col-span-full border-t border-[var(--color-line)] pt-3">
      <p className="mb-1.5 flex items-center gap-1.5 font-medium text-[var(--color-ink)]">
        <Truck size={13} /> Delivery
      </p>

      {order.shippingAddress && (
        <p className="mb-2 text-[var(--color-ink-soft)]">
          <span className="font-medium text-[var(--color-ink)]">Shipping address: </span>
          {order.shippingRecipientName && `${order.shippingRecipientName}, `}
          {[
            order.shippingAddress.line1,
            order.shippingAddress.line2,
            order.shippingAddress.city,
            order.shippingAddress.state,
            order.shippingAddress.postal_code,
            order.shippingAddress.country,
          ]
            .filter(Boolean)
            .join(', ')}
        </p>
      )}

      {error && <p className="mb-2 text-[var(--color-brand-dark)]">{error}</p>}

      {!editing && (
        <>
          {hasArranged ? (
            <p>
              {order.deliveryMethod ? METHOD_LABEL[order.deliveryMethod] : 'Method not yet set'}
              {order.trackingReference && ` · ${order.trackingReference}`}
              {order.trackingUrl && (
                <>
                  {' · '}
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--color-brand-dark)] hover:underline"
                  >
                    Track
                  </a>
                </>
              )}
            </p>
          ) : order.quoteRequestedAt ? (
            <p>Quote requested {formatDateTime(order.quoteRequestedAt)}</p>
          ) : (
            <p>Not yet arranged.</p>
          )}
          {order.deliveryNotes && <p className="mt-1 text-[var(--color-ink-soft)]">{order.deliveryNotes}</p>}

          {order.transferStatus === 'pending' && (
            <p className="mt-1 text-[var(--color-ink-soft)]">
              {order.receivedConfirmedAt
                ? 'Receipt confirmed — payout releasing.'
                : order.trackingStatus === 'delivered'
                  ? `Marked delivered ${formatDateTime(order.deliveredAt!)}. Relay will pay the seller automatically in 48 hours unless you confirm receipt or raise an issue sooner.`
                  : order.shippedAt
                    ? `Marked shipped ${formatDateTime(order.shippedAt)}. Relay holds the seller's payout until receipt is confirmed, or automatically after 14 days.`
                    : "Relay holds the seller's payout until the order ships and receipt is confirmed."}
            </p>
          )}
          {order.transferStatus === 'released' && (
            <p className="mt-1 flex items-center gap-1.5 text-[var(--color-moss)]">
              <CheckCircle2 size={13} /> Payout released to the seller.
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-3">
            {!order.quoteRequestedAt && !hasArranged && (
              <button
                onClick={handleRequestQuote}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
              >
                {busy && <Loader2 size={12} className="animate-spin" />}
                Request a shipping quote
              </button>
            )}
            {order.role === 'seller' && !order.shippedAt && order.transferStatus === 'pending' && (
              <button
                onClick={handleMarkShipped}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
              >
                {busy && <Loader2 size={12} className="animate-spin" />}
                Mark as shipped
              </button>
            )}
            {order.role === 'seller' &&
              order.shippedAt &&
              (order.deliveryMethod === 'courier' || order.deliveryMethod === 'freight') &&
              order.trackingStatus !== 'delivered' &&
              order.transferStatus === 'pending' && (
                <button
                  onClick={handleMarkDelivered}
                  disabled={busy || !order.trackingReference}
                  title={!order.trackingReference ? 'Add a tracking reference first' : undefined}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
                >
                  {busy && <Loader2 size={12} className="animate-spin" />}
                  Mark as delivered
                </button>
              )}
            {order.role === 'buyer' && order.transferStatus === 'pending' && !order.receivedConfirmedAt && (
              <button
                onClick={handleConfirmReceipt}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-full bg-[var(--color-moss)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {busy && <Loader2 size={12} className="animate-spin" />}
                Confirm receipt
              </button>
            )}
            {order.role === 'seller' && order.transferStatus === 'pending' && (isCollection || !order.shippedAt) && (
              <button
                onClick={handleGenerateHandoverCode}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-60"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <QrCode size={12} />}
                {handoverQr
                  ? 'Regenerate handover code'
                  : isCollection
                    ? 'Generate handover QR code'
                    : 'Generate QR to print on parcel'}
              </button>
            )}
            {canEditDetails && (
              <button
                onClick={() => setEditing(true)}
                className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
              >
                {hasArranged || order.deliveryNotes ? 'Edit details' : 'Record what was arranged'}
              </button>
            )}
          </div>

          {handoverQr && (
            <div className="mt-3 rounded-xl border border-[var(--color-line)] p-3">
              <style>{`
                @media print {
                  body * { visibility: hidden; }
                  #${labelPrintId}, #${labelPrintId} * { visibility: visible; }
                  #${labelPrintId} { position: fixed; inset: 0; padding: 32px; }
                }
              `}</style>
              <div id={labelPrintId} className="mx-auto max-w-xs text-center">
                {!isCollection && (
                  <div className="mb-3 text-left">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
                      Ship to
                    </p>
                    {order.shippingAddress ? (
                      <div className="mt-1 text-sm leading-relaxed">
                        <p className="font-medium text-[var(--color-ink)]">
                          {order.shippingRecipientName ?? order.counterpartyName}
                        </p>
                        <p>{order.shippingAddress.line1}</p>
                        {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                        <p>
                          {[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postal_code]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                        <p>{order.shippingAddress.country}</p>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                        Address not available yet — refresh in a moment.
                      </p>
                    )}
                  </div>
                )}
                <img src={handoverQr.dataUrl} alt="Handover QR code" className="mx-auto h-40 w-40" />
                <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
                  {order.title} · Order {order.id.slice(0, 8)}
                </p>
              </div>

              {!isCollection && (
                <div className="mt-3 flex justify-center">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
                  >
                    <Printer size={12} /> Print label
                  </button>
                </div>
              )}

              <p className="mt-2 text-center text-[var(--color-ink-soft)]">
                {isCollection
                  ? 'Show this to the buyer at handover.'
                  : 'Print this and stick it on the parcel. Scan it yourself when you send it to mark the order shipped, then the buyer scans it again when it arrives.'}{' '}
                Expires {formatDateTime(handoverQr.expiresAt)}.
              </p>
            </div>
          )}

        </>
      )}

      {editing && (
        <div className="mt-1 space-y-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
          >
            <option value="">Method…</option>
            <option value="collection">Local collection</option>
            <option value="courier">Courier / parcel</option>
            <option value="freight">Freight</option>
          </select>
          <input
            value={trackingReference}
            onChange={(e) => setTrackingReference(e.target.value)}
            placeholder="Tracking reference (optional)"
            className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
          />
          <input
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            placeholder="Tracking link (optional)"
            className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Meeting point / notes — e.g. where and when to collect, or anything else worth flagging"
            rows={2}
            className="w-full resize-none rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
            >
              {busy && <Loader2 size={12} className="animate-spin" />}
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 border-t border-[var(--color-line)] pt-3">
        <p className="mb-1.5 font-medium text-[var(--color-ink)]">
          Evidence{order.evidencePaths.length > 0 && ` (${order.evidencePaths.length})`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {order.evidencePaths.map((path) => (
            <EvidenceThumb key={path} orderId={order.id} path={path} onRemoved={onChanged} />
          ))}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-60"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : '+'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
        <p className="mt-1.5 text-[var(--color-ink-soft)]">
          Upload a photo of a receipt, drop-off slip, or tracking label as proof.
        </p>
      </div>
    </div>
  );
}
