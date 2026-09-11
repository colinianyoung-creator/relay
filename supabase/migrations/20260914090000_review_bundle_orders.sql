-- Reviewing an order paid via an accepted offer or a seller-sent invoice was
-- silently impossible: those orders carry bundle_listing_ids instead of
-- listing_id (listing_id is null), but the insert policy demanded an exact
-- listing_id match. Accept either shape a paid order can take.
drop policy "Buyer can review their own completed order" on public.reviews;

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
        and (o.listing_id = listing_id or listing_id = any(o.bundle_listing_ids))
    )
  );
