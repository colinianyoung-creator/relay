-- Fit profiles: a buyer's body measurements and impairment-relevant context,
-- used to filter/highlight listings that are actually likely to fit them —
-- the thing a generic classifieds board (or a Facebook group) can't do.
-- Kept separate from `profiles` since it's optional, buyer-specific data
-- that most sellers-only accounts will never fill in.
create table public.fit_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  primary_sport text,
  disability_notes text,
  classification text,
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  seat_width_cm numeric(5,1),
  seat_depth_cm numeric(5,1),
  inseam_cm numeric(5,1),
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.fit_profiles enable row level security;

create policy "Users can view their own fit profile"
  on public.fit_profiles for select
  using (auth.uid() = user_id);

create policy "Users can upsert their own fit profile"
  on public.fit_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own fit profile"
  on public.fit_profiles for update
  using (auth.uid() = user_id);

-- Structured, numeric spec fields on listings, additive to the existing
-- freeform `measurements` jsonb (which stays for anything that doesn't fit
-- a common column — release mechanisms, gearing, etc). Only the fields
-- relevant to a given sport/category get filled in by the seller; the rest
-- stay null and are simply not used for matching.
alter table public.listings
  add column seat_width_cm numeric(5,1),
  add column seat_depth_cm numeric(5,1),
  add column weight_capacity_kg numeric(5,1),
  add column min_user_height_cm numeric(5,1),
  add column max_user_height_cm numeric(5,1),
  add column min_user_weight_kg numeric(5,1),
  add column max_user_weight_kg numeric(5,1);
