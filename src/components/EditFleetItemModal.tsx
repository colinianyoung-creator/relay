import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { CONDITIONS, type Condition, type Listing } from '@/types';
import { updateFleetItem } from '@/lib/supabaseData';
import { SHOWS_SEAT_FIELDS } from '@/lib/listingFields';

// Editing a single item within an already-posted club-gear lot — a smaller
// surface than the full fleet-creation wizard (see the plan this shipped
// under): just the fields that belong to this one item, not the bundle's
// shared fields or membership. Modeled on PurchaseReviewModal's portal.
export function EditFleetItemModal({
  listing,
  onClose,
  onSaved,
}: {
  listing: Listing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(listing.title);
  const [price, setPrice] = useState(String(listing.price ?? ''));
  const [condition, setCondition] = useState<Condition>(listing.condition);
  const [sellableIndividually, setSellableIndividually] = useState(listing.sellableIndividually ?? true);
  const [seatWidthCm, setSeatWidthCm] = useState(listing.seatWidthCm?.toString() ?? '');
  const [seatDepthCm, setSeatDepthCm] = useState(listing.seatDepthCm?.toString() ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showsSeatFields = SHOWS_SEAT_FIELDS.includes(listing.sport);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const priceNumber = Number(price);
    if (!title.trim() || !priceNumber || priceNumber <= 0) {
      setError('Enter a title and a price above zero.');
      return;
    }
    setSubmitting(true);
    try {
      await updateFleetItem(listing.id, {
        title: title.trim(),
        price: priceNumber,
        condition,
        sellableIndividually,
        seatWidthCm: seatWidthCm ? Number(seatWidthCm) : null,
        seatDepthCm: seatDepthCm ? Number(seatDepthCm) : null,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong saving that item.');
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-paper-raised)] p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl">Edit item</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-[var(--color-ink-soft)]">Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs text-[var(--color-ink-soft)]">Price</label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[var(--color-ink-soft)]">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as Condition)}
                className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm"
              >
                {CONDITIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showsSeatFields && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-ink-soft)]">Seat width (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={seatWidthCm}
                  onChange={(e) => setSeatWidthCm(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-ink-soft)]">Seat depth (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={seatDepthCm}
                  onChange={(e) => setSeatDepthCm(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                />
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
            <input
              type="checkbox"
              checked={sellableIndividually}
              onChange={(e) => setSellableIndividually(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-line)]"
            />
            Also sellable on its own, outside this lot
          </label>

          {error && <p className="text-sm text-[var(--color-brand-dark)]">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            Save changes
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
