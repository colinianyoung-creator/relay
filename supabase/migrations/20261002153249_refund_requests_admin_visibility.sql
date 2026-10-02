-- refund_requests only ever got a buyer/seller SELECT policy (see
-- 20260915090000_refund_requests.sql) — unlike orders, which got its own
-- "Admins can view all orders" policy in 20260904090000. That gap means
-- AdminOrders' embedded refund:refund_requests(...) join always resolves to
-- null for an admin, so escalated/failed refund requests never show up in
-- the admin dashboard at all (confirmed live: escalating a refund request
-- leaves the ESCALATED count at 0 and the order missing from that filter).
-- The actual issue-refund/dismiss actions are fine — they run via edge
-- functions on the service role — only visibility was broken.
create policy "Admins can view all refund requests"
  on public.refund_requests for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
