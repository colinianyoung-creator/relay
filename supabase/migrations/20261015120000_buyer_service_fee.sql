-- Buyer-paid service fee, charged on top of an order's price at checkout.
-- `amount` stays the sale price (seller payout and commission are still
-- computed from it), so this column is purely the extra the buyer paid.
-- Zero for every order placed before the fee existed.
alter table public.orders
  add column buyer_fee_amount numeric(10,2) not null default 0;
