-- The only refund path today is an external bank chargeback, invisible to
-- the seller. Add an in-app request/approve flow instead — buyer requests,
-- seller approves or declines, same shape as the existing offer negotiation.
-- Approval is what actually calls Stripe (see respond-refund-request), since
-- these are Connect destination charges: reversing a transfer after the
-- seller's already been paid out can push their balance negative, so this
-- can't be a unilateral buyer-triggered action.

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'paid', 'cancelled', 'refunded'));

create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'pending' check (status in ('pending', 'declined', 'refunded', 'failed')),
  seller_response text,
  stripe_refund_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);

alter table public.refund_requests enable row level security;

create policy "Buyer or seller can view their order's refund request"
  on public.refund_requests for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
