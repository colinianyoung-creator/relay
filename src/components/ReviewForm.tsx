import { useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { createReview } from '@/lib/supabaseData';

export function ReviewForm({
  orderId,
  listingId,
  reviewerId,
  sellerId,
  sellerName,
  compact,
  onSubmitted,
}: {
  orderId: string;
  listingId: string;
  reviewerId: string;
  sellerId: string;
  sellerName: string;
  /** Smaller stars/text for use inline (e.g. an Orders-tab row) rather than a standalone card. */
  compact?: boolean;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return;
    setError(null);
    setSubmitting(true);
    try {
      await createReview(orderId, listingId, reviewerId, sellerId, rating, comment);
      onSubmitted();
    } catch {
      setError("Couldn't submit your review — try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  const starSize = compact ? 16 : 26;

  return (
    <form
      onSubmit={handleSubmit}
      className={compact ? '' : 'mt-10 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6 text-left'}
    >
      <p className={compact ? 'font-medium text-[var(--color-ink)]' : 'text-lg'}>
        How was buying from {sellerName.split(' ')[0]}?
      </p>
      <div className={`flex gap-1 ${compact ? 'mt-1.5' : 'mt-3'}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
          >
            <Star
              size={starSize}
              className={
                n <= (hoverRating || rating)
                  ? 'fill-[var(--color-brand)] text-[var(--color-brand)]'
                  : 'text-[var(--color-line)]'
              }
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything worth telling other buyers? (optional)"
        rows={compact ? 2 : 3}
        className={`w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] outline-none focus:border-[var(--color-ink-soft)] ${
          compact ? 'mt-2 p-2.5 text-xs' : 'mt-4 p-3 text-sm'
        }`}
      />
      {error && <p className="mt-2 text-xs text-[var(--color-brand-dark)]">{error}</p>}
      <button
        type="submit"
        disabled={rating === 0 || submitting}
        className={`mt-3 flex items-center gap-2 rounded-full bg-[var(--color-ink)] font-medium text-white hover:bg-black disabled:opacity-50 ${
          compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'
        }`}
      >
        {submitting && <Loader2 size={compact ? 12 : 15} className="animate-spin" />}
        Submit review
      </button>
    </form>
  );
}
