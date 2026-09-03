-- Posting fee: a flat charge to publish a for-sale listing, collected via
-- Stripe Checkout. Free/donation listings (price is null) stay exempt —
-- charging to give something away would work against the platform's own
-- liquidity goals. Wanted posts are untouched by this migration entirely;
-- they stay free to keep that side of the board frictionless.
--
-- New for-sale listings start 'pending' and are invisible to everyone but
-- their own seller until a webhook confirms payment and flips them to
-- 'paid'. Existing rows (and all free listings going forward) default to
-- 'exempt' so nothing already published is affected.

create type public.listing_fee_status as enum ('exempt', 'pending', 'paid');

alter table public.listings
  add column fee_status public.listing_fee_status not null default 'exempt',
  add column stripe_checkout_session_id text;

create unique index idx_listings_stripe_session on public.listings(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- Replace the old "anyone can read any listing" policy: public reads now
-- exclude listings still waiting on payment, but a seller can always see
-- their own regardless of status (so they can watch it move from pending
-- to paid, or clean it up if they abandon checkout).
drop policy "Listings are publicly readable" on public.listings;

create policy "Paid or exempt listings are publicly readable"
  on public.listings for select
  using (fee_status <> 'pending' or auth.uid() = seller_id);
