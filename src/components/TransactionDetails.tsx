import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { formatDateTime, formatPrice } from '@/lib/format';
import type { MyOrder } from '@/lib/supabaseData';

export function TransactionDetails({
  id,
  createdAt,
  amount,
  currency,
  counterpartyName,
  role,
  statusLabel,
  platformFeeAmount,
  listingLink,
  extra,
}: {
  id: string;
  createdAt: string;
  amount: number;
  currency: MyOrder['currency'];
  counterpartyName: string;
  role: 'buyer' | 'seller';
  statusLabel: string;
  platformFeeAmount?: number;
  listingLink?: string | null;
  extra?: ReactNode;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-[var(--color-paper)] p-4 text-xs text-[var(--color-ink-soft)] sm:grid-cols-3">
      <div>
        <p className="font-medium text-[var(--color-ink)]">Status</p>
        <p>{statusLabel}</p>
      </div>
      <div>
        <p className="font-medium text-[var(--color-ink)]">{role === 'buyer' ? 'Seller' : 'Buyer'}</p>
        <p>{counterpartyName}</p>
      </div>
      <div>
        <p className="font-medium text-[var(--color-ink)]">Date</p>
        <p>{formatDateTime(createdAt)}</p>
      </div>
      <div>
        <p className="font-medium text-[var(--color-ink)]">Amount</p>
        <p>{formatPrice(amount, currency)}</p>
      </div>
      {platformFeeAmount !== undefined && role === 'seller' && (
        <>
          <div>
            <p className="font-medium text-[var(--color-ink)]">Commission</p>
            <p>−{formatPrice(platformFeeAmount, currency)}</p>
          </div>
          <div>
            <p className="font-medium text-[var(--color-ink)]">Payout</p>
            <p className="font-medium text-[var(--color-moss)]">
              {formatPrice(amount - platformFeeAmount, currency)}
            </p>
          </div>
        </>
      )}
      <div>
        <p className="font-medium text-[var(--color-ink)]">Reference</p>
        <p className="font-mono">{id.slice(0, 8)}</p>
      </div>
      {extra}
      {listingLink && (
        <Link
          to={listingLink}
          className="col-span-full inline-flex w-fit items-center gap-1 text-[var(--color-brand-dark)] hover:underline"
        >
          View listing <ExternalLink size={12} />
        </Link>
      )}
    </div>
  );
}
