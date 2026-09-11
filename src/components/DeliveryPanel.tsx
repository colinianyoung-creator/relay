import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Truck, X } from 'lucide-react';
import {
  deleteDeliveryEvidence,
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
            <button
              onClick={() => setEditing(true)}
              className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
            >
              {hasArranged || order.deliveryNotes ? 'Edit details' : 'Record what was arranged'}
            </button>
          </div>
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
