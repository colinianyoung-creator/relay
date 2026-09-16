import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { COUNTRIES } from '@/types';
import { createPurchaseCheckout, type CheckoutShippingAddress } from '@/lib/supabaseData';
import { METHOD_LABEL } from '@/components/DeliveryPanel';
import { formatPrice } from '@/lib/format';
import type { Currency } from '@/types';

type DeliveryMethod = 'collection' | 'courier' | 'freight';

// Shown before Stripe Checkout for a direct Buy Now purchase — until now
// delivery method was never chosen by the buyer at all (only set by the
// seller after the sale), and address only got collected inside Stripe's
// own generic page. This captures both in Relay's own UI first.
export function PurchaseReviewModal({
  listingId,
  listingTitle,
  listingPrice,
  currency,
  sellerName,
  deliveryMethods,
  onClose,
}: {
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  currency: Currency;
  sellerName: string;
  deliveryMethods: DeliveryMethod[];
  onClose: () => void;
}) {
  const [method, setMethod] = useState<DeliveryMethod>(deliveryMethods[0]);
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState<string>(COUNTRIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsAddress = method !== 'collection';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (needsAddress && (!line1.trim() || !city.trim() || !postalCode.trim())) {
      setError('Fill in an address so the seller knows where to send it.');
      return;
    }
    setSubmitting(true);
    try {
      const shippingAddress: CheckoutShippingAddress | null = needsAddress
        ? {
            line1: line1.trim(),
            line2: line2.trim() || undefined,
            city: city.trim(),
            state: state.trim() || undefined,
            postal_code: postalCode.trim(),
            country,
          }
        : null;
      const origin = window.location.origin;
      const url = await createPurchaseCheckout(
        listingId,
        method,
        shippingAddress,
        `${origin}/purchase/confirm?listing_id=${listingId}`,
        `${origin}/listing/${listingId}`,
      );
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong starting checkout.');
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-paper-raised)] p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl">Review your order</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-[var(--color-paper)] p-3 text-sm">
            <span className="text-[var(--color-ink-soft)]">{listingTitle}</span>
            <span className="font-medium">{formatPrice(listingPrice, currency)}</span>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-[var(--color-ink-soft)]">Delivery</label>
            {deliveryMethods.length === 1 ? (
              <p className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm">
                {METHOD_LABEL[deliveryMethods[0]]}
              </p>
            ) : (
              <div className="space-y-2">
                {deliveryMethods.map((m) => (
                  <label
                    key={m}
                    className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] px-3.5 py-2 text-sm has-[:checked]:border-[var(--color-ink)]"
                  >
                    <input
                      type="radio"
                      name="delivery-method"
                      checked={method === m}
                      onChange={() => setMethod(m)}
                      className="h-4 w-4"
                    />
                    {METHOD_LABEL[m]}
                  </label>
                ))}
              </div>
            )}
          </div>

          {needsAddress && (
            <div className="space-y-2.5">
              <label className="block text-xs text-[var(--color-ink-soft)]">Shipping address</label>
              <input
                required
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                placeholder="Address line 1"
                className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
              <input
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
                placeholder="Address line 2 (optional)"
                className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Town or city"
                  className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                />
                <input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="County/state (optional)"
                  className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  required
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="Postcode"
                  className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                />
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {method === 'collection' && (
            <p className="text-xs text-[var(--color-ink-soft)]">
              No address needed — you'll arrange a pickup time with {sellerName.split(' ')[0]} directly.
            </p>
          )}

          {error && <p className="text-sm text-[var(--color-brand-dark)]">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            Continue to payment
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
