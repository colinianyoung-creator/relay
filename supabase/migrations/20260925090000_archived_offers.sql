-- Same per-user "hide from my own view" marker as archived_listings /
-- archived_orders (see 20260922090000_archived_items.sql), for finished
-- offers (declined / withdrawn) so they can be tidied out of the Offers tab
-- without touching the offer row the other party can still see.

create table public.archived_offers (
  user_id uuid not null references public.profiles(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, offer_id)
);

create index idx_archived_offers_offer_id on public.archived_offers(offer_id);

alter table public.archived_offers enable row level security;

create policy "Users can view their own archived offers"
  on public.archived_offers for select
  using (auth.uid() = user_id);

create policy "Users can archive offers"
  on public.archived_offers for insert
  with check (auth.uid() = user_id);

create policy "Users can unarchive offers"
  on public.archived_offers for delete
  using (auth.uid() = user_id);
