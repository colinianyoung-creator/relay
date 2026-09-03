import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Loader2, Receipt, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchAllOrders, type AdminOrder } from '@/lib/supabaseData';
import { Badge } from '@/components/Badge';
import { AdminTabs } from '@/components/AdminTabs';
import { formatPrice, timeAgo } from '@/lib/format';

const FILTERS = ['all', 'pending', 'paid', 'cancelled', 'disputed'] as const;
type Filter = (typeof FILTERS)[number];

function statusTone(status: AdminOrder['status']): 'brand' | 'moss' | 'neutral' {
  if (status === 'paid') return 'moss';
  if (status === 'pending') return 'brand';
  return 'neutral';
}

export function AdminOrders() {
  const { user, profile, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!profile?.is_admin) return;
    fetchAllOrders()
      .then(setOrders)
      .catch(() => setError('Could not load orders.'));
  }, [profile?.is_admin]);

  const stats = useMemo(() => {
    if (!orders) return null;
    const paid = orders.filter((o) => o.status === 'paid');
    const disputed = orders.filter((o) => o.disputedAt);
    // GMV/fees only summed in GBP to keep the header honest — mixing
    // currencies into one total would misrepresent the number.
    const gbpPaid = paid.filter((o) => o.currency === 'GBP');
    const gmv = gbpPaid.reduce((sum, o) => sum + o.amount, 0);
    const fees = gbpPaid.reduce((sum, o) => sum + o.platformFeeAmount, 0);
    return { total: orders.length, paidCount: paid.length, disputedCount: disputed.length, gmv, fees };
  }, [orders]);

  const visible = useMemo(() => {
    if (!orders) return null;
    if (filter === 'all') return orders;
    if (filter === 'disputed') return orders.filter((o) => o.disputedAt);
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

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
    <div className="mx-auto max-w-5xl px-6 py-10">
      <AdminTabs />
      <div className="flex items-center gap-2">
        <Receipt size={22} className="text-[var(--color-brand)]" />
        <h1 className="text-2xl">Orders</h1>
      </div>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        Every in-app purchase and posting-fee payment, plus Stripe disputes as they land.
      </p>

      {error && <p className="mt-4 text-sm text-[var(--color-brand-dark)]">{error}</p>}

      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">Orders</div>
            <div className="mt-1 text-xl">{stats.total}</div>
          </div>
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">GMV (GBP, paid)</div>
            <div className="mt-1 text-xl">{formatPrice(stats.gmv, 'GBP')}</div>
          </div>
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">Fees earned (GBP)</div>
            <div className="mt-1 text-xl">{formatPrice(stats.fees, 'GBP')}</div>
          </div>
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">Disputed</div>
            <div className="mt-1 flex items-center gap-1.5 text-xl">
              {stats.disputedCount}
              {stats.disputedCount > 0 && <AlertTriangle size={16} className="text-[var(--color-brand)]" />}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
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
            No {filter === 'all' ? '' : filter} orders.
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((o) => (
              <div key={o.id} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {o.listingId ? (
                        <Link
                          to={`/listing/${o.listingId}`}
                          className="text-sm font-medium hover:text-[var(--color-brand)]"
                        >
                          {o.listingTitle}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-[var(--color-ink-soft)]">{o.listingTitle}</span>
                      )}
                      <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                      {o.disputedAt && (
                        <Badge tone="brand">
                          <AlertTriangle size={11} /> {o.disputeStatus?.replace(/_/g, ' ') ?? 'disputed'}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                      {o.buyerName} → {o.sellerName}
                    </p>
                    <p className="mt-2 text-xs text-[var(--color-ink-soft)]/80">
                      {o.stripePaymentIntentId ?? o.stripeCheckoutSessionId ?? 'no Stripe reference'}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="font-display text-lg">{formatPrice(o.amount, o.currency)}</div>
                    <div className="text-xs text-[var(--color-ink-soft)]">
                      fee {formatPrice(o.platformFeeAmount, o.currency)}
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-ink-soft)]">{timeAgo(o.createdAt.slice(0, 10))}</div>
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
