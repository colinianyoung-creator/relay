import { useState } from 'react';
import { Loader2, Truck } from 'lucide-react';
import { requestShippingQuote, updateDeliveryDetails, type MyOrder } from '@/lib/supabaseData';
import { formatDateTime } from '@/lib/format';

const METHOD_LABEL: Record<string, string> = {
  collection: 'Local collection',
  courier: 'Courier / parcel',
  freight: 'Freight',
};

/**
 * Relay doesn't book carriers — this is a shared place for the buyer and
 * seller to ask for a quote (which nudges the other side via a message) and
 * record whatever they actually arranged externally.
 */
export function DeliveryPanel({ order, onChanged }: { order: MyOrder; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState(order.deliveryMethod ?? '');
  const [trackingReference, setTrackingReference] = useState(order.trackingReference ?? '');
  const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl ?? '');

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
      });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save those details.');
    } finally {
      setBusy(false);
    }
  }

  const hasArranged = Boolean(order.deliveryMethod || order.trackingReference || order.trackingUrl);

  return (
    <div className="col-span-full border-t border-[var(--color-line)] pt-3">
      <p className="mb-1.5 flex items-center gap-1.5 font-medium text-[var(--color-ink)]">
        <Truck size={13} /> Delivery
      </p>

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
              {hasArranged ? 'Edit details' : 'Record what was arranged'}
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
    </div>
  );
}
