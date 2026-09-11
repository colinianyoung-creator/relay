-- Stripe Checkout wasn't collecting a shipping address at all, so even a
-- courier-shipped sale had nowhere for it to live — buyer and seller had to
-- type it into a message by hand. Extend the existing delivery side table
-- rather than adding a new one; only stripe-webhook (service-role) writes
-- these, populated from the Checkout session's own shipping_details.

alter table public.order_deliveries add column shipping_address jsonb;
alter table public.order_deliveries add column shipping_recipient_name text;
