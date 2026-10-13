import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { fileListingReport } from '@/lib/supabaseData';
import { useModalA11y } from '@/lib/useModalA11y';

const REASONS = [
  "Doesn't match the description",
  'Suspected stolen or counterfeit',
  'Unsafe or recalled equipment',
  'Prohibited or unrelated item',
  'Other',
];

export function ReportListingModal({
  listingId,
  listingTitle,
  reporterId,
  onClose,
}: {
  listingId: string;
  listingTitle: string;
  reporterId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const containerRef = useModalA11y(onClose);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await fileListingReport(listingId, listingTitle, reporterId, reason, details);
      setSubmitted(true);
    } catch {
      setError("Couldn't send your report — try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      ref={containerRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-listing-title"
        className="w-full max-w-sm rounded-2xl bg-[var(--color-paper-raised)] p-6 shadow-xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="report-listing-title" className="text-xl">Report this listing</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="text-[var(--color-moss)]" size={32} />
            <p className="text-sm text-[var(--color-ink-soft)]">
              Thanks — we'll review this listing.
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
            <div>
              <label htmlFor="report-reason" className="mb-1 block text-xs text-[var(--color-ink-soft)]">Reason</label>
              <select
                id="report-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="report-details" className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                Details (optional)
              </label>
              <textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
            </div>

            {error && <p role="alert" className="text-sm text-[var(--color-brand-dark)]">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              Send report
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
