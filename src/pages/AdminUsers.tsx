import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, Users, BadgeCheck, ShieldPlus, ShieldMinus, Ban, CircleCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchAllUsers, updateUserAdminAction, type AdminUser, type AdminUserAction } from '@/lib/supabaseData';
import { Badge } from '@/components/Badge';
import { AdminTabs } from '@/components/AdminTabs';
import { timeAgo } from '@/lib/format';

export function AdminUsers() {
  const { user, profile, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.is_admin) return;
    fetchAllUsers()
      .then(setUsers)
      .catch(() => setError('Could not load users.'));
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

  async function act(target: AdminUser, action: AdminUserAction) {
    setError(null);
    setBusyId(target.id);
    try {
      await updateUserAdminAction(target.id, action);
      setUsers(
        (prev) =>
          prev &&
          prev.map((u) => {
            if (u.id !== target.id) return u;
            if (action === 'verify' || action === 'unverify') return { ...u, verified: action === 'verify' };
            if (action === 'grantAdmin' || action === 'revokeAdmin') return { ...u, isAdmin: action === 'grantAdmin' };
            if (action === 'ban') return { ...u, bannedUntil: '9999-12-31T00:00:00Z' };
            if (action === 'unban') return { ...u, bannedUntil: null };
            return u;
          }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <AdminTabs />
      <div className="flex items-center gap-2">
        <Users size={22} className="text-[var(--color-brand)]" />
        <h1 className="text-2xl">Users</h1>
      </div>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        {users ? `${users.length} account${users.length === 1 ? '' : 's'}` : 'Visible only to admins.'}
      </p>

      {error && <p role="alert" className="mt-4 text-sm text-[var(--color-brand-dark)]">{error}</p>}

      <div className="mt-6">
        {users === null ? (
          <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                  <th className="p-4 font-medium">Member</th>
                  <th className="p-4 font-medium">Sales</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Joined</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {users.map((u) => {
                  const isSelf = u.id === user.id;
                  const isBanned = !!u.bannedUntil && new Date(u.bannedUntil) > new Date();
                  const busy = busyId === u.id;
                  return (
                    <tr key={u.id}>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-medium">
                          {u.name}
                          {u.verified && <BadgeCheck size={14} className="text-[var(--color-moss-dark)]" />}
                          {isSelf && <span className="text-xs text-[var(--color-ink-soft)]">(you)</span>}
                        </div>
                        <div className="text-xs text-[var(--color-ink-soft)]">{u.email}</div>
                        {u.club && <div className="text-xs text-[var(--color-ink-soft)]">{u.club}</div>}
                      </td>
                      <td className="p-4 text-[var(--color-ink-soft)]">
                        {u.salesCount} · {u.rating.toFixed(1)}★
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                          {u.isAdmin && <Badge tone="brand">Admin</Badge>}
                          {u.payoutsEnabled && <Badge tone="moss">Payouts</Badge>}
                          {isBanned && <Badge tone="brand">Banned</Badge>}
                        </div>
                      </td>
                      <td className="p-4 text-[var(--color-ink-soft)]">{timeAgo(u.createdAt.slice(0, 10))}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => act(u, u.verified ? 'unverify' : 'verify')}
                            disabled={busy}
                            className="flex items-center gap-1 rounded-full border border-[var(--color-line)] px-2.5 py-1 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-50"
                          >
                            <CircleCheck size={12} /> {u.verified ? 'Unverify' : 'Verify'}
                          </button>
                          <button
                            onClick={() => {
                              if (busy || (isSelf && u.isAdmin)) return;
                              act(u, u.isAdmin ? 'revokeAdmin' : 'grantAdmin');
                            }}
                            aria-disabled={busy || (isSelf && u.isAdmin)}
                            aria-label={
                              isSelf && u.isAdmin
                                ? "Revoke admin — disabled, you can't revoke your own admin access"
                                : undefined
                            }
                            title={isSelf && u.isAdmin ? "You can't revoke your own admin access." : undefined}
                            className="flex items-center gap-1 rounded-full border border-[var(--color-line)] px-2.5 py-1 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
                          >
                            {u.isAdmin ? <ShieldMinus size={12} /> : <ShieldPlus size={12} />}
                            {u.isAdmin ? 'Revoke admin' : 'Make admin'}
                          </button>
                          <button
                            onClick={() => {
                              if (busy || isSelf) return;
                              act(u, isBanned ? 'unban' : 'ban');
                            }}
                            aria-disabled={busy || isSelf}
                            aria-label={isSelf ? "Ban — disabled, you can't ban your own account" : undefined}
                            title={isSelf ? "You can't ban your own account." : undefined}
                            className="flex items-center gap-1 rounded-full border border-[var(--color-brand)] px-2.5 py-1 text-xs text-[var(--color-brand-dark)] hover:bg-[var(--color-brand-soft)] aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
                          >
                            <Ban size={12} /> {isBanned ? 'Unban' : 'Ban'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
