import { AlertTriangle } from 'lucide-react';

/** Shown at the top of every policy page until a real lawyer has signed off. Remove once that's done. */
export function LegalDraftNotice() {
  return (
    <div className="mb-8 flex items-start gap-3 rounded-xl border border-[var(--color-brand)] bg-[var(--color-brand-soft)] p-4 text-sm text-[var(--color-brand-dark)]">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <p>
        <strong>Draft, not legal advice.</strong> This page reflects how Relay actually works
        today, but hasn't been reviewed by a lawyer. Have qualified counsel check it — especially
        the VAT/marketplace-facilitator and consumer-rights sections — before relying on it
        commercially.
      </p>
    </div>
  );
}
