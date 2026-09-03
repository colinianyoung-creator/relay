-- Admin order/dispute visibility. Orders already existed (buyer/seller-only
-- RLS from the payments migration) but had no admin-wide view, and Stripe
-- disputes weren't tracked anywhere at all — a chargeback would only ever
-- show up in the Stripe dashboard, invisible to anyone using Relay's own
-- admin tools.

-- dispute_status mirrors Stripe's own Dispute.status values directly
-- (https://stripe.com/docs/api/disputes/object#dispute_object-status) rather
-- than inventing a smaller taxonomy — one less mapping to keep in sync as
-- Stripe's dispute lifecycle evolves.
alter table public.orders
  add column disputed_at timestamptz,
  add column dispute_status text check (
    dispute_status in (
      'warning_needs_response', 'warning_under_review', 'warning_closed',
      'needs_response', 'under_review', 'charge_refunded', 'won', 'lost'
    )
  );

create policy "Admins can view all orders"
  on public.orders for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
