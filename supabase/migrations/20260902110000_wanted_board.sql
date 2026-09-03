-- Wanted board: buyers post what they're looking for (sport, size range,
-- budget) so sellers with matching outgrown kit can find them directly —
-- this is the other half of the liquidity problem a pure "for sale" board
-- doesn't solve on its own, especially at low listing volume.
create table public.wanted_listings (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  sport text not null,
  category text not null,
  description text not null,
  max_price numeric(10,2),
  currency text not null default 'GBP',
  country text not null,
  open_to_international boolean not null default false,
  status text not null default 'open' check (status in ('open', 'fulfilled')),
  seat_width_cm numeric(5,1),
  seat_depth_cm numeric(5,1),
  min_user_height_cm numeric(5,1),
  max_user_height_cm numeric(5,1),
  min_user_weight_kg numeric(5,1),
  max_user_weight_kg numeric(5,1),
  created_at timestamptz not null default now()
);

create index idx_wanted_listings_buyer_id on public.wanted_listings(buyer_id);

alter table public.wanted_listings enable row level security;

create policy "Wanted posts are publicly readable"
  on public.wanted_listings for select
  using (true);

create policy "Users can create their own wanted posts"
  on public.wanted_listings for insert
  with check (auth.uid() = buyer_id);

create policy "Users can update their own wanted posts"
  on public.wanted_listings for update
  using (auth.uid() = buyer_id);

create policy "Users can delete their own wanted posts"
  on public.wanted_listings for delete
  using (auth.uid() = buyer_id);

-- Messages need to support two kinds of thread now: about a for-sale
-- listing (existing), or about a wanted post (new) — a seller responding
-- "I've got one of these". Exactly one of the two target columns is set.
alter table public.messages
  alter column listing_id drop not null,
  add column wanted_id uuid references public.wanted_listings(id) on delete cascade,
  add constraint messages_exactly_one_target check (
    (listing_id is not null and wanted_id is null) or
    (listing_id is null and wanted_id is not null)
  );

create index idx_messages_wanted_id on public.messages(wanted_id);

drop policy "Sender or listing seller can view messages" on public.messages;

create policy "Sender or thread owner can view messages"
  on public.messages for select
  using (
    auth.uid() = sender_id
    or auth.uid() = (select seller_id from public.listings where id = messages.listing_id)
    or auth.uid() = (select buyer_id from public.wanted_listings where id = messages.wanted_id)
  );
