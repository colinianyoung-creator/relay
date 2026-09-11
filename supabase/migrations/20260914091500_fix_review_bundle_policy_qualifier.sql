-- The previous migration's unqualified `listing_id` inside the EXISTS
-- subquery got resolved to orders.listing_id (shadowed by the `o` alias)
-- instead of the review row being inserted, so the bundle-order check
-- silently compared o.listing_id to itself instead of to the submitted
-- review — verified live: still 403'd. Qualify explicitly this time.
drop policy "Buyer can review their own completed order" on public.reviews;

create policy "Buyer can review their own completed order"
  on public.reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.orders o
      where o.id = reviews.order_id
        and o.buyer_id = auth.uid()
        and o.status = 'paid'
        and o.seller_id = reviews.reviewee_id
        and (o.listing_id = reviews.listing_id or reviews.listing_id = any(o.bundle_listing_ids))
    )
  );
