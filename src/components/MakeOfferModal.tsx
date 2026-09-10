import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { createOffer } from '@/lib/supabaseData';
import { formatPrice } from '@/lib/format';
import type { Currency } from '@/types';

export function MakeOfferModal({
  listingId,
  listingPrice,
  currency,
  sellerName,
  onClose,
}: {
  listingId: string;
  listingPrice: number;
  currency: Currency;
  sellerName: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(listingPrice));
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!(Number(amount) > 0)) {
      setError('Enter an amount greater than zero.');
      return;
    }
    setSubmitting(true);
    try {
      await createOffer(listingId, Number(amount), currency, message.trim() || undefined);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your offer — try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-paper-raised)] p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl">Make an offer</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="text-[var(--color-moss)]" size={32} />
            <p className="text-sm text-[var(--color-ink-soft)]">
              Offer sent — {sellerName.split(' ')[0]} typically replies within a day. You can track
              it from your account's Offers tab.
            </p>
            <button
              onClick={onClose}
              className="mt-2 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white hover:bg-black"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-[var(--color-ink-soft)]">
              Asking price is {formatPrice(listingPrice, currency)}. Propose what you'd actually
              pay — {sellerName.split(' ')[0]} can accept, decline, or counter.
            </p>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                Your offer ({currency})
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                Message (optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="e.g. I can collect this week if that works for you."
                className="w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
            </div>

            {error && <p className="text-sm text-[var(--color-brand-dark)]">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              Send offer
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
