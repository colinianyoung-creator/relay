-- Club fleet liquidations: a seller groups several of their own unsold
-- listings into one sellable lot, bought in a single Stripe checkout. See
-- the "Club Fleet Liquidations" plan for the full rationale — in short,
-- adaptive sports clubs own their members' equipment outright and replace
-- their whole fleet in one grant-funded upgrade every few years, with no
-- clean way today to liquidate 10-15 chairs at once other than one-by-one.

create table public.listing_bundles (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  status text not null default 'active' check (status in ('active', 'sold', 'cancelled')),
  created_at timestamptz not null default now()
);

create index idx_listing_bundles_seller_id on public.listing_bundles(seller_id);

alter table public.listings
  add column bundle_id uuid references public.listing_bundles(id) on delete set null;

create index idx_listings_bundle_id on public.listings(bundle_id);

-- An order is either a single-listing purchase (existing flow, unchanged)
-- or a bundle purchase — bundle_listing_ids is a denormalized snapshot of
-- what was actually bought, same reasoning as listing_reports'
-- listing_title_snapshot: read-only history once paid, so a join table
-- would be solving a problem (membership changing after the fact) that
-- doesn't exist here.
alter table public.orders
  alter column listing_id drop not null,
  add column bundle_id uuid references public.listing_bundles(id) on delete set null,
  add column bundle_listing_ids uuid[],
  add constraint orders_exactly_one_target check (
    (listing_id is not null and bundle_id is null) or
    (listing_id is null and bundle_id is not null)
  );

alter table public.listing_bundles enable row level security;

create policy "Bundles are publicly readable"
  on public.listing_bundles for select
  using (true);

create policy "Sellers can create their own bundles"
  on public.listing_bundles for insert
  with check (auth.uid() = seller_id);

create policy "Sellers can update their own bundles"
  on public.listing_bundles for update
  using (auth.uid() = seller_id);

create policy "Admins can delete any bundle"
  on public.listing_bundles for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- Extended to increment by an arbitrary count (a bundle sale is N chairs,
-- not one) rather than calling the old single-increment version N times.
-- Dropped and recreated rather than `create or replace`, since changing the
-- parameter list creates a second overloaded function instead of actually
-- replacing the original.
drop function if exists public.increment_sales_count(uuid);

create function public.increment_sales_count(p_seller_id uuid, p_count integer default 1)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set sales_count = sales_count + p_count where id = p_seller_id;
$$;
