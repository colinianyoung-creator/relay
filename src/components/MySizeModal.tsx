import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Ruler } from 'lucide-react';

export interface QuickFitValues {
  heightCm: number | null;
  weightKg: number | null;
  seatWidthCm: number | null;
  seatDepthCm: number | null;
}

function numOrNull(v: string): number | null {
  return v.trim() === '' ? null : Number(v);
}

export function MySizeModal({
  initial,
  canSave,
  onApply,
  onClose,
}: {
  initial: QuickFitValues;
  canSave: boolean;
  onApply: (values: QuickFitValues, save: boolean) => Promise<void> | void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<QuickFitValues>(initial);
  const [save, setSave] = useState(canSave);
  const [submitting, setSubmitting] = useState(false);

  const hasAny = !!(values.heightCm || values.weightKg || values.seatWidthCm || values.seatDepthCm);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasAny) return;
    setSubmitting(true);
    try {
      await onApply(values, save && canSave);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-paper-raised)] p-6 shadow-xl">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl">
            <Ruler size={18} /> Your size
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-5 text-sm text-[var(--color-ink-soft)]">
          Fill in whatever you know — listings only get filtered out on a real mismatch, matched
          with a bit of leeway rather than an exact fit.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">Height (cm)</label>
              <input
                type="number"
                value={values.heightCm ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, heightCm: numOrNull(e.target.value) }))}
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">Weight (kg)</label>
              <input
                type="number"
                value={values.weightKg ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, weightKg: numOrNull(e.target.value) }))}
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                Seat width (cm)
              </label>
              <input
                type="number"
                value={values.seatWidthCm ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, seatWidthCm: numOrNull(e.target.value) }))}
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                Seat depth (cm)
              </label>
              <input
                type="number"
                value={values.seatDepthCm ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, seatDepthCm: numOrNull(e.target.value) }))}
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
            </div>
          </div>

          {canSave && (
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
              <input
                type="checkbox"
                checked={save}
                onChange={(e) => setSave(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-line)]"
              />
              Save to my profile so I don't have to enter this again
            </label>
          )}

          <button
            type="submit"
            disabled={submitting || !hasAny}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            Show what fits me
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
