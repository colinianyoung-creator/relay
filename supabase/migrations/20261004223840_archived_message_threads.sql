-- Same per-user "hide from my own view" marker as archived_listings /
-- archived_orders / archived_offers (see 20260922090000_archived_items.sql,
-- 20260925090000_archived_offers.sql), for message threads. A thread has no
-- row of its own (it's messages grouped by listing_id + other party), so
-- this keys on that same (listing_id, other_party_id) pair instead of a
-- single foreign key. created_at doubles as "archived at": the client
-- treats a thread as still archived only while its latest message is older
-- than this timestamp, so a new reply after archiving un-hides it again
-- instead of silently burying it.

create table public.archived_message_threads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  other_party_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id, other_party_id)
);

create index idx_archived_message_threads_listing on public.archived_message_threads(listing_id);

alter table public.archived_message_threads enable row level security;

create policy "Users can view their own archived threads"
  on public.archived_message_threads for select
  using (auth.uid() = user_id);

create policy "Users can archive their own threads"
  on public.archived_message_threads for insert
  with check (auth.uid() = user_id);

create policy "Users can re-archive their own threads"
  on public.archived_message_threads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can unarchive their own threads"
  on public.archived_message_threads for delete
  using (auth.uid() = user_id);
