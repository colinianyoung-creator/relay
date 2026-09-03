-- Listing reports: the "Report this listing" button in the UI was a dead
-- end with nothing behind it — this gives it somewhere real to write to.
-- No admin UI ships with this yet; reports are queryable directly until
-- there's a moderation dashboard to build one.
create table public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create index idx_listing_reports_listing_id on public.listing_reports(listing_id);

alter table public.listing_reports enable row level security;

create policy "Reporters can view their own reports"
  on public.listing_reports for select
  using (auth.uid() = reporter_id);

create policy "Users can file a report"
  on public.listing_reports for insert
  with check (auth.uid() = reporter_id);

-- Reviews: one per completed order, buyer reviewing seller. profiles.rating
-- and profiles.sales_count have existed since the initial schema but nothing
-- ever wrote to them for real transactions — they were static demo-style
-- numbers. This closes that gap.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (order_id)
);

create index idx_reviews_reviewee_id on public.reviews(reviewee_id);

alter table public.reviews enable row level security;

create policy "Reviews are publicly readable"
  on public.reviews for select
  using (true);

-- Only the buyer on a *paid* order can leave a review, and only for that
-- order's actual seller/listing — prevents reviewing sales that never
-- happened or reviewing someone else's transaction.
create policy "Buyer can review their own completed order"
  on public.reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.buyer_id = auth.uid()
        and o.status = 'paid'
        and o.seller_id = reviewee_id
        and o.listing_id = listing_id
    )
  );

-- Keeps profiles.rating as a live average instead of a static number.
create function public.recalculate_seller_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid := coalesce(new.reviewee_id, old.reviewee_id);
begin
  update public.profiles
  set rating = coalesce(
    (select round(avg(rating)::numeric, 1) from public.reviews where reviewee_id = target_id),
    5.0
  )
  where id = target_id;
  return null;
end;
$$;

create trigger on_review_change
  after insert or update or delete on public.reviews
  for each row execute function public.recalculate_seller_rating();

-- Atomic increment for the webhook (service role) to call when an order is
-- marked paid — avoids a select-then-update race on concurrent sales.
create function public.increment_sales_count(p_seller_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set sales_count = sales_count + 1 where id = p_seller_id;
$$;
