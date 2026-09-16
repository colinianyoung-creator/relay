-- Sellers previously only set a delivery method after a sale (DeliveryPanel);
-- buyers had no idea before paying how they'd actually receive the item.
-- This lets a seller declare upfront what they support, so Buy Now can show
-- it (and collect an address only when needed) before money moves.
alter table public.listings
  add column delivery_methods text[] not null default '{}'
  check (delivery_methods <@ array['collection', 'courier', 'freight']);

-- Backfill: courier was always the implicit assumption until now, so this
-- changes nothing about how existing listings currently behave.
update public.listings set delivery_methods = '{courier}' where delivery_methods = '{}';
