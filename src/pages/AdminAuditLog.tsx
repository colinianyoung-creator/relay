import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, History, ShieldAlert, BadgeCheck, ShieldPlus, ShieldMinus, Ban, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchAuditLog, type AdminAuditLogEntry } from '@/lib/supabaseData';
import { AdminTabs } from '@/components/AdminTabs';
import { timeAgo } from '@/lib/format';

const ICONS: Record<string, typeof History> = {
  report_status_changed: ShieldAlert,
  listing_deleted: Trash2,
  verify: BadgeCheck,
  unverify: BadgeCheck,
  grantAdmin: ShieldPlus,
  revokeAdmin: ShieldMinus,
  ban: Ban,
  unban: Ban,
};

function describe(entry: AdminAuditLogEntry): string {
  const d = entry.details ?? {};
  switch (entry.action) {
    case 'report_status_changed':
      return `${entry.adminName} marked the report on "${d.listing_title ?? 'a listing'}" as ${d.to}`;
    case 'listing_deleted':
      return `${entry.adminName} removed listing "${d.title ?? entry.targetId}" (seller: ${d.seller_name ?? 'unknown'})`;
    case 'verify':
      return `${entry.adminName} verified ${d.targetName ?? 'a member'}`;
    case 'unverify':
      return `${entry.adminName} removed verification from ${d.targetName ?? 'a member'}`;
    case 'grantAdmin':
      return `${entry.adminName} made ${d.targetName ?? 'a member'} an admin`;
    case 'revokeAdmin':
      return `${entry.adminName} revoked admin access from ${d.targetName ?? 'a member'}`;
    case 'ban':
      return `${entry.adminName} banned ${d.targetName ?? 'a member'}`;
    case 'unban':
      return `${entry.adminName} unbanned ${d.targetName ?? 'a member'}`;
    default:
      return `${entry.adminName} performed ${entry.action} on ${entry.targetType} ${entry.targetId ?? ''}`;
  }
}

export function AdminAuditLog() {
  const { user, profile, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<AdminAuditLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.is_admin) return;
    fetchAuditLog()
      .then(setEntries)
      .catch(() => setError('Could not load the audit log.'));
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

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <AdminTabs />
      <div className="flex items-center gap-2">
        <History size={22} className="text-[var(--color-brand)]" />
        <h1 className="text-2xl">Admin activity</h1>
      </div>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        Every privileged action, logged automatically — not something an admin can edit or clear from
        here.
      </p>

      {error && <p className="mt-4 text-sm text-[var(--color-brand-dark)]">{error}</p>}

      <div className="mt-6">
        {entries === null ? (
          <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-16 text-center text-[var(--color-ink-soft)]">
            No admin actions logged yet.
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
            {entries.map((entry) => {
              const Icon = ICONS[entry.action] ?? History;
              return (
                <div key={entry.id} className="flex items-start gap-3 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]">
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{describe(entry)}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                      {timeAgo(entry.createdAt.slice(0, 10))}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
