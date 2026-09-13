-- Non-delivery fraud protection: move from Stripe destination charges
-- (seller paid the instant a buyer checks out) to separate charges and
-- transfers. The charge now lands in Relay's own platform balance, and the
-- seller's share only transfers once the buyer confirms receipt, or 14
-- days after the seller marks it shipped if the buyer never responds.
-- confirm-receipt / auto-release-transfers / releaseTransfer.ts do the
-- actual work; this migration just adds the state they need to track.

alter table public.orders add column transfer_status text not null default 'pending'
  check (transfer_status in ('pending', 'released', 'refunded'));
alter table public.orders add column stripe_transfer_id text;
alter table public.orders add column transfer_released_at timestamptz;
alter table public.orders add column transfer_released_by text
  check (transfer_released_by in ('buyer_confirmed', 'auto_release', 'admin'));

alter table public.order_deliveries add column shipped_at timestamptz;
alter table public.order_deliveries add column received_confirmed_at timestamptz;
alter table public.order_deliveries add column release_reminder_sent_at timestamptz;

-- Admin can now issue a refund directly (e.g. a seller who never shipped),
-- not just respond to a buyer-initiated request — track who started it.
alter table public.refund_requests add column initiated_by text not null default 'buyer'
  check (initiated_by in ('buyer', 'admin'));

-- No scheduled-job infrastructure exists anywhere else in this codebase —
-- this is the first use of pg_cron/pg_net, needed to check daily for
-- reminder emails and auto-releases without a client ever having to load
-- a page for it to happen.
--
-- Auth: the function checks an `x-cron-secret` header against its own
-- CRON_SECRET env var, rather than handing the cron job the full
-- service-role key. Both the function's CRON_SECRET secret and this
-- 'cron_secret' Vault entry are set manually after this migration runs
-- (not committed here) — see the deploy notes for the exact commands.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select
  cron.schedule(
    'auto-release-transfers',
    '0 3 * * *',
    $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'auto_release_function_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body := '{}'::jsonb
    );
    $$
  );
