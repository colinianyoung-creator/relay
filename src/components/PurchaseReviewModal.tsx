import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { METHOD_LABEL } from '@/components/DeliveryPanel';
import { formatPrice } from '@/lib/format';
import type { Currency } from '@/types';

type DeliveryMethod = 'collection' | 'courier' | 'freight';

// Shown before Stripe Checkout for any direct purchase — Buy Now
// (create-purchase-checkout) or paying an accepted offer/custom invoice
// (pay-custom-order). Delivery method used to be chosen by neither buyer nor
// this step at all (only ever set by the seller after the sale) — this
// captures it in Relay's own UI first, since Stripe's checkout page has no
// concept of "collection vs courier" and the seller's supported methods
// need validating either way. The actual shipping address, when one's
// needed, is still collected on Stripe's own checkout page. The caller
// supplies `onConfirm` so this component doesn't need to know which of the
// two flows it's in.
export function PurchaseReviewModal({
  title,
  price,
  currency,
  sellerName,
  deliveryMethods,
  onConfirm,
  onClose,
}: {
  title: string;
  price: number;
  currency: Currency;
  sellerName: string;
  deliveryMethods: DeliveryMethod[];
  onConfirm: (method: DeliveryMethod) => Promise<string>;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<DeliveryMethod | null>(deliveryMethods[0] ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!method) return;
    setSubmitting(true);
    try {
      const url = await onConfirm(method);
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
            <span className="text-[var(--color-ink-soft)]">{title}</span>
            <span className="font-medium">{formatPrice(price, currency)}</span>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-[var(--color-ink-soft)]">Delivery</label>
            {deliveryMethods.length === 0 ? (
              <p className="rounded-xl border border-[var(--color-brand)] bg-[var(--color-brand-soft)] px-3.5 py-2 text-sm text-[var(--color-brand-dark)]">
                These items don't share a common delivery method — message {sellerName.split(' ')[0]} to
                sort out delivery before paying.
              </p>
            ) : deliveryMethods.length === 1 ? (
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

          {method !== null && method !== 'collection' && (
            <p className="text-xs text-[var(--color-ink-soft)]">
              You'll enter your shipping address on the next step, at checkout.
            </p>
          )}

          {method === 'collection' && (
            <p className="text-xs text-[var(--color-ink-soft)]">
              No address needed — you'll arrange a pickup time with {sellerName.split(' ')[0]} directly.
            </p>
          )}

          {error && <p className="text-sm text-[var(--color-brand-dark)]">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !method}
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
