-- Lets a user hide a sold listing or a completed order from their own
-- Account view without touching the underlying row — orders in particular
-- carry real payment/refund/dispute history that should never be
-- deletable, so "archive" is purely a per-user presence marker, same shape
-- as saved_listings (insert to archive, delete to unarchive).

create table public.archived_listings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index idx_archived_listings_listing_id on public.archived_listings(listing_id);

alter table public.archived_listings enable row level security;

create policy "Users can view their own archived listings"
  on public.archived_listings for select
  using (auth.uid() = user_id);

create policy "Users can archive listings"
  on public.archived_listings for insert
  with check (auth.uid() = user_id);

create policy "Users can unarchive listings"
  on public.archived_listings for delete
  using (auth.uid() = user_id);

create table public.archived_orders (
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, order_id)
);

create index idx_archived_orders_order_id on public.archived_orders(order_id);

alter table public.archived_orders enable row level security;

create policy "Users can view their own archived orders"
  on public.archived_orders for select
  using (auth.uid() = user_id);

create policy "Users can archive orders"
  on public.archived_orders for insert
  with check (auth.uid() = user_id);

create policy "Users can unarchive orders"
  on public.archived_orders for delete
  using (auth.uid() = user_id);
