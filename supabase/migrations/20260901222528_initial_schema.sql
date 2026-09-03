-- Relay marketplace: core schema
-- Demo/seed listings shown on Browse live in the frontend's static data file,
-- not this database — this schema only holds real user-generated content
-- (signed-up sellers, their listings, saves, and messages), so we never need
-- to fabricate fake auth.users rows for the demo sellers.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  club text,
  verified boolean not null default false,
  rating numeric(2,1) not null default 5.0,
  sales_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  sport text not null,
  category text not null,
  condition text not null,
  price numeric(10,2),
  currency text not null default 'GBP',
  description text not null,
  measurements jsonb not null default '[]'::jsonb,
  location text not null,
  country text not null,
  ships_internationally boolean not null default false,
  featured boolean not null default false,
  posted_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.saved_listings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  sent_at timestamptz not null default now()
);

create index idx_listings_seller_id on public.listings(seller_id);
create index idx_messages_listing_id on public.messages(listing_id);
create index idx_saved_listings_listing_id on public.saved_listings(listing_id);

-- Auto-create a profile row when someone signs up. Display name comes from
-- signup metadata (set by the client at sign-up time); falls back to the
-- email local-part so the row is never left without a usable name.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.saved_listings enable row level security;
alter table public.messages enable row level security;

-- Profiles are publicly readable (seller profile pages, listing cards need
-- seller name/verified/rating) but only editable by the profile's own owner.
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Listings are publicly readable (Browse works for logged-out visitors);
-- only the authenticated owner can create/edit/delete their own.
create policy "Listings are publicly readable"
  on public.listings for select
  using (true);

create policy "Users can create their own listings"
  on public.listings for insert
  with check (auth.uid() = seller_id);

create policy "Users can update their own listings"
  on public.listings for update
  using (auth.uid() = seller_id);

create policy "Users can delete their own listings"
  on public.listings for delete
  using (auth.uid() = seller_id);

-- Saved listings are private to the user who saved them.
create policy "Users can view their own saved listings"
  on public.saved_listings for select
  using (auth.uid() = user_id);

create policy "Users can save listings"
  on public.saved_listings for insert
  with check (auth.uid() = user_id);

create policy "Users can unsave listings"
  on public.saved_listings for delete
  using (auth.uid() = user_id);

-- Messages are visible to the sender and to the listing's seller (a simple
-- two-party thread — no group messaging in this prototype).
create policy "Sender or listing seller can view messages"
  on public.messages for select
  using (
    auth.uid() = sender_id
    or auth.uid() = (select seller_id from public.listings where id = listing_id)
  );

create policy "Users can send messages as themselves"
  on public.messages for insert
  with check (auth.uid() = sender_id);
