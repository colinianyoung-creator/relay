-- A seller approving a refund request today releases the money immediately
-- with nothing checking the item actually came back — fine for "never
-- arrived" (buyer never had it) but a real gap for "changed my mind",
-- "not as described" or "damaged", where the seller may want the item back
-- first. This adds an optional tracked-return step, mirroring the existing
-- order_deliveries/handover-QR flow but in reverse: the buyer ships to the
-- seller instead of the seller shipping to the buyer. Approve remains a
-- manual override regardless of return status — this table only gates what
-- the seller sees, never what they're allowed to click (see refundOrder.ts,
-- unchanged by this migration).
--
-- One row per order, same shape as order_deliveries: a single reusable
-- handover_token, opened at /scan/:token by whichever side needs to act —
-- the buyer to mark it sent (mirroring the seller's "mark as sent" on the
-- outbound leg), the seller to confirm it arrived (mirroring the buyer's
-- confirm-receipt). No Stripe/payout logic lives here at all.
create table public.order_returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  return_address jsonb not null,
  return_recipient_name text not null,
  handover_token text,
  handover_token_expires_at timestamptz,
  tracking_reference text,
  tracking_url text,
  notes text,
  shipped_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.order_returns enable row level security;

create policy "Buyer or seller can view their order's return info"
  on public.order_returns for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (auth.uid() = o.buyer_id or auth.uid() = o.seller_id)
    )
  );

-- No insert/update policies — every write goes through the request-return /
-- mark-return-shipped / confirm-return-received edge functions (service
-- role), same as order_deliveries' handover fields.
