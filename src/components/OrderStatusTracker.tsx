import { Check } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

export interface TrackerStep {
  label: string;
  /** ISO timestamp once this step has happened; omit while it's still upcoming. */
  timestamp?: string | null;
  /** Overrides the default done/upcoming look — 'current' gets the accent ring, 'error' gets the brand-red treatment (e.g. declined). */
  state?: 'done' | 'current' | 'error';
}

/**
 * A compact progress line — done steps as filled checks joined by a solid
 * line, the current step as an accent ring, everything after as hollow/
 * greyed. Replaces the wall of conditional prose sentences that used to
 * carry order/refund/return status (e.g. "Marked shipped 26 Sept 2026,
 * 14:23. Relay holds the seller's payout until..."), matching how Vinted/
 * eBay show parcel tracking as a line of steps rather than paragraphs.
 * Runs left-to-right at sm width and up; below that it's a vertical
 * timeline (dot-and-line down the left edge, matching Vinted's own mobile
 * tracking screen) rather than a bare numbered list, so the connecting
 * line — the whole point of a tracker — never disappears on a phone.
 */
export function OrderStatusTracker({ steps }: { steps: TrackerStep[] }) {
  const lastDoneIndex = steps.reduce(
    (acc, s, i) => (s.state === 'done' || (s.timestamp && s.state !== 'current') ? i : acc),
    -1,
  );

  return (
    <div className="flex flex-col sm:flex-row sm:items-start">
      {steps.map((step, i) => {
        const isError = step.state === 'error';
        const isDone = step.state === 'done' || (!!step.timestamp && !isError && step.state !== 'current');
        const isCurrent = step.state === 'current' || (i === lastDoneIndex + 1 && !isError);
        const lineDone = i < lastDoneIndex && !isError;
        const isLast = i === steps.length - 1;

        return (
          <div key={step.label} className="flex sm:flex-1 sm:flex-col">
            <div className="flex flex-col items-center sm:w-full sm:flex-row">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-semibold ${
                  isError
                    ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                    : isDone
                      ? 'border-[var(--color-moss)] bg-[var(--color-moss)] text-white'
                      : isCurrent
                        ? 'border-[var(--color-ink)] bg-[var(--color-paper)] text-[var(--color-ink)]'
                        : 'border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink-soft)]'
                }`}
              >
                {isDone ? <Check size={13} /> : isError ? '!' : i + 1}
              </span>
              {!isLast && (
                <span
                  className={`my-0.5 w-0.5 flex-1 sm:mx-1.5 sm:my-0 sm:h-0.5 sm:w-auto ${
                    lineDone ? 'bg-[var(--color-moss)]' : 'bg-[var(--color-line)]'
                  }`}
                />
              )}
            </div>
            <div className={`ml-3 sm:ml-0 sm:mt-1.5 ${isLast ? '' : 'pb-3 sm:pb-0'}`}>
              <p
                className={`text-xs font-medium ${
                  isError
                    ? 'text-[var(--color-brand-dark)]'
                    : isDone || isCurrent
                      ? 'text-[var(--color-ink)]'
                      : 'text-[var(--color-ink-soft)]'
                }`}
              >
                {step.label}
              </p>
              {step.timestamp && (
                <p className="text-[10px] text-[var(--color-ink-soft)]">{formatDateTime(step.timestamp)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
