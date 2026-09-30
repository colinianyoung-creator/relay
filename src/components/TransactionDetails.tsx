import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { formatDateTime, formatPrice } from '@/lib/format';
import type { MyOrder } from '@/lib/supabaseData';
import { Badge } from './Badge';
import { OrderStatusTracker, type TrackerStep } from './OrderStatusTracker';

export function TransactionDetails({
  id,
  createdAt,
  amount,
  currency,
  counterpartyName,
  role,
  statusLabel,
  statusTone = 'neutral',
  platformFeeAmount,
  listingLink,
  /** When given, this leads the panel as a step tracker instead of a plain status badge — the "where is this right now" story at a glance, same as the delivery/return trackers below it. */
  steps,
  extra,
}: {
  id: string;
  createdAt: string;
  amount: number;
  currency: MyOrder['currency'];
  counterpartyName: string;
  role: 'buyer' | 'seller';
  statusLabel: string;
  /** 'brand' for something needing attention, 'moss' for a settled/good state. */
  statusTone?: 'neutral' | 'brand' | 'moss';
  platformFeeAmount?: number;
  listingLink?: string | null;
  steps?: TrackerStep[];
  extra?: ReactNode;
}) {
  const payout = platformFeeAmount !== undefined ? amount - platformFeeAmount : undefined;

  return (
    <div className="mt-3 rounded-xl bg-[var(--color-paper)] p-4">
      {steps ? (
        <div className="mb-4">
          <OrderStatusTracker steps={steps} />
        </div>
      ) : (
        <div className="mb-3">
          <Badge tone={statusTone}>{statusLabel}</Badge>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--color-line)] pt-3 text-xs text-[var(--color-ink-soft)]">
        <p>
          <span className="font-medium text-[var(--color-ink)]">
            {role === 'buyer' ? 'Seller' : 'Buyer'}
          </span>{' '}
          {counterpartyName}
        </p>
        <p>
          <span className="font-medium text-[var(--color-ink)]">Date</span> {formatDateTime(createdAt)}
        </p>
        {payout !== undefined && role === 'seller' ? (
          <p>
            <span className="font-medium text-[var(--color-ink)]">Payout</span>{' '}
            <span className="font-medium text-[var(--color-moss)]">{formatPrice(payout, currency)}</span>
            <span className="text-[var(--color-ink-soft)]/70">
              {' '}
              ({formatPrice(amount, currency)} − {formatPrice(platformFeeAmount!, currency)} commission)
            </span>
          </p>
        ) : (
          <p>
            <span className="font-medium text-[var(--color-ink)]">Amount</span> {formatPrice(amount, currency)}
          </p>
        )}
        <p className="font-mono text-[var(--color-ink-soft)]/70">#{id.slice(0, 8)}</p>
      </div>

      {extra}
      {listingLink && (
        <Link
          to={listingLink}
          className="mt-3 inline-flex w-fit items-center gap-1 text-[var(--color-brand-dark)] hover:underline"
        >
          View listing <ExternalLink size={12} />
        </Link>
      )}
    </div>
  );
}
