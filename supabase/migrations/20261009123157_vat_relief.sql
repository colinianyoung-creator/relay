-- UK VAT relief (VAT Notice 701/7): a VAT-registered seller can zero-rate
-- an item "designed solely for use by a disabled person" when the buyer is
-- chronically sick or disabled and buying it for their own personal use —
-- but only once the buyer has given a written declaration to that effect.
-- Only meaningful for a seller_type = 'commercial' listing (see
-- 20261006202442_listing_seller_type.sql) — a private individual's sale was
-- never VAT-able in the first place, so there's nothing to relieve.
--
-- Relay doesn't calculate or remit any VAT itself — sellers price their own
-- items under whatever VAT treatment they apply. This is purely the
-- paperwork: letting a commercial seller flag an eligible item, and
-- capturing the buyer's declaration against the order so the seller has it
-- on file, exactly as HMRC requires before they can zero-rate the sale.
alter table public.listings add column vat_relief_eligible boolean not null default false;
alter table public.orders add column vat_relief_declared boolean not null default false;
alter table public.orders add column vat_relief_declared_at timestamptz;
