import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Loader2, ShieldAlert, Trash2, CheckCircle2, RotateCcw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchAllReports, updateReportStatus, adminDeleteListing, type AdminReport } from '@/lib/supabaseData';
import { Badge } from '@/components/Badge';
import { AdminTabs } from '@/components/AdminTabs';
import { timeAgo } from '@/lib/format';

export function AdminReports() {
  const { user, profile, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.is_admin) return;
    fetchAllReports().then(setReports);
  }, [profile?.is_admin]);

  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-[var(--color-ink-soft)]" />
      </div>
    );
  }

  if (!user || !profile?.is_admin) {
    return <Navigate to="/" replace />;
  }

  async function setStatus(reportId: string, status: 'open' | 'resolved') {
    setBusyId(reportId);
    try {
      await updateReportStatus(reportId, status);
      setReports((prev) => prev && prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
    } finally {
      setBusyId(null);
    }
  }

  async function removeListing(report: AdminReport) {
    if (!report.listingId) return;
    if (!confirm(`Remove "${report.listingTitle}" from Relay? This can't be undone.`)) return;
    setBusyId(report.id);
    try {
      await adminDeleteListing(report.listingId);
      await updateReportStatus(report.id, 'resolved');
      setReports(
        (prev) =>
          prev &&
          prev.map((r) =>
            r.listingId === report.listingId ? { ...r, listingId: null, status: 'resolved' } : r,
          ),
      );
    } finally {
      setBusyId(null);
    }
  }

  const visible = reports?.filter((r) => filter === 'all' || r.status === filter) ?? null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <AdminTabs />
      <div className="flex items-center gap-2">
        <ShieldAlert size={22} className="text-[var(--color-brand)]" />
        <h1 className="text-2xl">Reported listings</h1>
      </div>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        Visible only to admins — gated by RLS, not just this page.
      </p>

      <div className="mt-6 flex gap-2">
        {(['open', 'resolved', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
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

      <div className="mt-6">
        {visible === null ? (
          <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-16 text-center text-[var(--color-ink-soft)]">
            No {filter === 'all' ? '' : filter} reports.
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((r) => (
              <div key={r.id} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      {r.listingId ? (
                        <Link
                          to={`/listing/${r.listingId}`}
                          className="text-sm font-medium hover:text-[var(--color-brand)]"
                        >
                          {r.listingTitle}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-[var(--color-ink-soft)]">
                          {r.listingTitle}
                        </span>
                      )}
                      <Badge tone={r.status === 'open' ? 'brand' : 'moss'}>{r.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm">{r.reason}</p>
                    {r.details && <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{r.details}</p>}
                    <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
                      Reported by {r.reporterName} · {timeAgo(r.createdAt.slice(0, 10))}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {r.status === 'open' ? (
                      <button
                        onClick={() => setStatus(r.id, 'resolved')}
                        disabled={busyId === r.id}
                        className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-50"
                      >
                        <CheckCircle2 size={13} /> Mark resolved
                      </button>
                    ) : (
                      <button
                        onClick={() => setStatus(r.id, 'open')}
                        disabled={busyId === r.id}
                        className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-50"
                      >
                        <RotateCcw size={13} /> Reopen
                      </button>
                    )}
                    {r.listingId && (
                      <button
                        onClick={() => removeListing(r)}
                        disabled={busyId === r.id}
                        className="flex items-center gap-1.5 rounded-full border border-[var(--color-brand)] px-3 py-1.5 text-xs font-medium text-[var(--color-brand-dark)] hover:bg-[var(--color-brand-soft)] disabled:opacity-50"
                      >
                        <Trash2 size={13} /> Remove listing
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
