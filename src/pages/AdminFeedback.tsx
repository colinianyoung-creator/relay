import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CheckCircle2, Loader2, MessageSquareText, RotateCcw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchAllFeedback, updateFeedbackStatus, type AdminFeedback } from '@/lib/supabaseData';
import { useActionItems } from '@/lib/actionItemsContext';
import { Badge } from '@/components/Badge';
import { AdminTabs } from '@/components/AdminTabs';
import { timeAgo } from '@/lib/format';

export function AdminFeedbackPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { refresh } = useActionItems();
  const [items, setItems] = useState<AdminFeedback[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'new' | 'resolved' | 'all'>('new');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.is_admin) return;
    fetchAllFeedback()
      .then(setItems)
      .catch(() => setError('Could not load feedback.'));
  }, [profile?.is_admin]);

  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-[var(--color-ink-soft)]" />
      </div>
    );
  }

  if (!user || !profile?.is_admin) return <Navigate to="/" replace />;

  async function setStatus(id: string, status: 'new' | 'resolved') {
    setBusyId(id);
    setError(null);
    try {
      await updateFeedbackStatus(id, status);
      setItems((prev) => prev && prev.map((f) => (f.id === id ? { ...f, status } : f)));
      refresh();
    } catch {
      setError("Couldn't update that message. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  const visible = items?.filter((f) => filter === 'all' || f.status === filter) ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <AdminTabs />
      <div className="flex items-center gap-2">
        <MessageSquareText size={22} className="text-[var(--color-brand)]" />
        <h1 className="text-2xl">Feedback</h1>
      </div>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        Sent from the Feedback button, by signed-in members and visitors. Visible only to admins.
      </p>

      <div className="mt-6 flex gap-2">
        {(['new', 'resolved', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize ${
              filter === f
                ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
                : 'border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-[var(--color-brand-dark)]">{error}</p>}

      <div className="mt-6">
        {visible === null ? (
          <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-16 text-center text-[var(--color-ink-soft)]">
            No {filter === 'all' ? '' : filter} feedback.
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((f) => (
              <div key={f.id} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{f.senderName ?? 'Visitor (not signed in)'}</span>
                      <Badge tone={f.status === 'new' ? 'brand' : 'moss'}>{f.status}</Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">{f.message}</p>
                    <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
                      {timeAgo(f.createdAt.slice(0, 10))}
                      {f.pagePath && <> · on {f.pagePath}</>}
                      {f.viewport && <> · {f.viewport}</>}
                      {f.contactEmail && (
                        <>
                          {' · '}
                          <a href={`mailto:${f.contactEmail}`} className="underline hover:text-[var(--color-ink)]">
                            {f.contactEmail}
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  {f.status === 'new' ? (
                    <button
                      onClick={() => setStatus(f.id, 'resolved')}
                      disabled={busyId === f.id}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} /> Mark resolved
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus(f.id, 'new')}
                      disabled={busyId === f.id}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-50"
                    >
                      <RotateCcw size={13} /> Reopen
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
