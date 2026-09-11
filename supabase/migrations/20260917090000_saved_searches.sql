-- Lets a buyer save a search and get emailed when a new listing matches it.
-- Same self-scoped RLS shape as saved_listings — only the owner ever
-- creates/deletes their own rows, no service-role write policy needed.

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sport text,
  condition text,
  country text,
  min_price numeric(10,2),
  max_price numeric(10,2),
  free_only boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_saved_searches_user_id on public.saved_searches(user_id);

alter table public.saved_searches enable row level security;

create policy "Users can view their own saved searches"
  on public.saved_searches for select
  using (auth.uid() = user_id);

create policy "Users can create saved searches"
  on public.saved_searches for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own saved searches"
  on public.saved_searches for delete
  using (auth.uid() = user_id);
