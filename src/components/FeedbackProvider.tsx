import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Loader2, MessageSquarePlus, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { submitFeedback } from '@/lib/supabaseData';
import { useModalA11y } from '@/lib/useModalA11y';
import { FeedbackContext } from '@/lib/feedbackContext';

const MAX_LENGTH = 2000;

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const containerRef = useModalA11y(onClose);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await submitFeedback({ message: message.trim(), email: email.trim(), website });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that. Please try again in a moment.");
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
        aria-labelledby="feedback-title"
        className="w-full max-w-md rounded-2xl bg-[var(--color-paper-raised)] p-6 shadow-xl"
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 id="feedback-title" className="text-xl">Send feedback</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div aria-live="polite" className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="text-[var(--color-moss-dark)]" size={32} />
            <p className="text-sm text-[var(--color-ink-soft)]">
              Thank you. Your feedback has been sent, and I read every message.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white hover:bg-black"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-[var(--color-ink-soft)]">
              Relay is in beta. Tell us what's working, what's broken, or what you wish it did. We'll
              see which page you were on and your screen size, to help us reproduce problems.
            </p>
            <div>
              <label htmlFor="feedback-message" className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                Your feedback
              </label>
              <textarea
                id="feedback-message"
                required
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
                rows={5}
                maxLength={MAX_LENGTH}
                className="w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
              <p className="mt-1 text-right text-xs text-[var(--color-ink-soft)]">
                {message.length}/{MAX_LENGTH}
              </p>
            </div>
            <div>
              <label htmlFor="feedback-email" className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                Email, if you'd like a reply (optional)
              </label>
              <input
                id="feedback-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
            </div>

            {/* Honeypot: invisible and unreachable for people, filled in by bots. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
            </div>

            {error && <p role="alert" className="text-sm text-[var(--color-brand-dark)]">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              Send feedback
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openFeedback = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openFeedback }), [openFeedback]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {/* On phones the footer link carries this, so nothing covers the content. */}
      <button
        type="button"
        onClick={openFeedback}
        className="fixed bottom-4 right-4 z-40 hidden items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-black sm:flex"
      >
        <MessageSquarePlus size={16} aria-hidden="true" />
        Feedback
        <span className="rounded-full border border-current px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide">
          Beta
        </span>
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </FeedbackContext.Provider>
  );
}
