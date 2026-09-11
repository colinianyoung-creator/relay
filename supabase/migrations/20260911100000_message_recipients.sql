-- Messages previously had no real "recipient" — the only defined other
-- party was the listing's seller, which meant a seller's reply was
-- invisible to everyone, including the original buyer (RLS only granted
-- select to a row's own sender or the listing's seller, so a reply row
-- authored by the seller was visible to... the seller). Adding a real
-- recipient_id makes a genuine two-way thread possible, including when a
-- listing has messages from multiple different buyers.
--
-- Also drops the wanted-board wiring on this table (listing_id nullable,
-- wanted_id, the "exactly one target" constraint) now that the Wanted
-- board feature itself has been removed from the app — this table only
-- ever carries listing threads again.

drop policy "Sender or thread owner can view messages" on public.messages;
alter table public.messages drop constraint messages_exactly_one_target;
alter table public.messages drop column wanted_id;
alter table public.messages alter column listing_id set not null;

alter table public.messages add column recipient_id uuid references public.profiles(id) on delete cascade;

-- Every existing row was sent buyer -> seller (the only path that existed
-- until now), so backfill accordingly.
update public.messages m
set recipient_id = l.seller_id
from public.listings l
where m.listing_id = l.id;

alter table public.messages alter column recipient_id set not null;

create index idx_messages_recipient_id on public.messages(recipient_id);

create policy "Sender or recipient can view messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy "Users can send messages as themselves" on public.messages;

create policy "Users can send messages as themselves"
  on public.messages for insert
  with check (auth.uid() = sender_id and recipient_id is not null and recipient_id <> sender_id);
