-- Buyer-initiated offers: a buyer proposes a price on a listing, the seller
-- (or buyer again, after a counter) accepts / declines / counters. Accepting
-- creates a normal custom-order invoice (bundle_listing_ids = [listing_id],
-- same shape create-custom-order already produces), so pay-custom-order,
-- stripe-webhook and the Invoices tab need no changes at all to handle it.

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null,
  message text,
  -- Whose proposal is currently on the table — the other party is the one
  -- who can accept/decline/counter; this side can only withdraw.
  proposed_by text not null check (proposed_by in ('buyer', 'seller')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_offers_listing_id on public.offers(listing_id);
create index idx_offers_buyer_id on public.offers(buyer_id);
create index idx_offers_seller_id on public.offers(seller_id);

-- One open negotiation per buyer per listing at a time.
create unique index idx_offers_one_pending_per_buyer_listing
  on public.offers(listing_id, buyer_id) where status = 'pending';

alter table public.offers enable row level security;

-- Written only by service-role edge functions, same pattern as orders —
-- no client insert/update policy.
create policy "Buyer or seller can view their own offers"
  on public.offers for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
