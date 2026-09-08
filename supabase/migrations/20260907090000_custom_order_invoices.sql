-- Relaxes the "exactly one target" constraint on orders so a multi-item
-- purchase no longer needs a formal listing_bundles row behind it.
-- bundle_listing_ids is now the general "which of the seller's listings
-- this covers" mechanism, whether it came from a browsable /fleets listing
-- or a one-off negotiated invoice between two parties who messaged each
-- other. orders.bundle_id stays as optional provenance only.
alter table public.orders
  drop constraint orders_exactly_one_target,
  add constraint orders_exactly_one_target check (
    (listing_id is not null and bundle_listing_ids is null) or
    (listing_id is null and bundle_listing_ids is not null and array_length(bundle_listing_ids, 1) > 0)
  );
