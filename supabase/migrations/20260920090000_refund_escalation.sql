-- A declined refund request was previously a dead end for the buyer — no
-- formal way to escalate, no admin visibility. Adds a second step: the
-- buyer can escalate a declined request to Relay, and admin can then
-- either issue the refund (reusing admin-refund-order) or dismiss it.

alter table public.refund_requests drop constraint refund_requests_status_check;
alter table public.refund_requests add constraint refund_requests_status_check
  check (status in ('pending', 'declined', 'refunded', 'failed', 'escalated', 'dismissed'));

alter table public.refund_requests add column escalated_at timestamptz;
alter table public.refund_requests add column admin_note text;
