-- Lets a seller create a whole fleet's listings + the bundle together in one
-- wizard (instead of creating each listing separately first, then grouping
-- them). See the "Fleet listing" plan.

-- A fleet-listing bundle starts 'draft' while its combined posting-fee
-- checkout is in flight, and only becomes 'active' (visible on /fleets) once
-- the webhook confirms payment — otherwise the bundle card would show up
-- publicly while every listing inside it is still fee_status 'pending' and
-- RLS-hidden from everyone but its seller, i.e. an apparently-empty bundle.
alter table public.listing_bundles
  drop constraint listing_bundles_status_check,
  add constraint listing_bundles_status_check check (status in ('draft', 'active', 'sold', 'cancelled')),
  add column stripe_checkout_session_id text unique;

-- One Stripe Checkout now covers every listing in a fleet at once, so the
-- session id lives on the bundle rather than being duplicated onto each
-- listing row (which the existing unique index on
-- listings.stripe_checkout_session_id wouldn't allow anyway).

-- Whether a listing is also purchasable on its own /listing/:id page, not
-- only as part of its fleet. Defaults true so every existing listing, and
-- every listing created through the ordinary single-listing flow (which
-- never surfaces this control), keeps behaving exactly as it does today.
alter table public.listings
  add column sellable_individually boolean not null default true;
