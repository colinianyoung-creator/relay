-- In-platform checkout: buyers pay sellers directly through Relay via
-- Stripe Connect (Express accounts), instead of only arranging payment
-- off-platform after messaging. A seller must complete Stripe's own
-- onboarding (identity + bank details) before they can receive a payout —
-- until then, listings just fall back to the existing message-only flow.
--
-- Relay takes a small platform commission on each sale (see
-- PLATFORM_FEE_PERCENT in the create-purchase-checkout edge function) via
-- Stripe's application_fee_amount on a destination charge — Stripe handles
-- the split at settlement, Relay never custodies buyer funds itself.

alter table public.profiles
  add column stripe_connect_account_id text,
  add column stripe_connect_charges_enabled boolean not null default false;

create unique index idx_profiles_stripe_connect_account
  on public.profiles(stripe_connect_account_id)
  where stripe_connect_account_id is not null;

-- A listing is "sold" once sold_at is set; unlike the fee_status/pending
-- gate, sold listings stay visible (marked as sold) rather than being
-- hidden, matching how real resale marketplaces behave.
alter table public.listings
  add column sold_at timestamptz,
  add column buyer_id uuid references public.profiles(id) on delete set null;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null,
  currency text not null,
  platform_fee_amount numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create unique index idx_orders_stripe_session on public.orders(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create index idx_orders_listing_id on public.orders(listing_id);
create index idx_orders_buyer_id on public.orders(buyer_id);
create index idx_orders_seller_id on public.orders(seller_id);

alter table public.orders enable row level security;

-- Orders are only ever written by the edge functions (service role, which
-- bypasses RLS) — buyer and seller can each read their own side of it.
create policy "Buyer or seller can view their own orders"
  on public.orders for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
