-- Two faster, delivery-method-specific release triggers on top of the
-- delayed-payout system: a 48-hour dispute window after the seller
-- self-reports courier delivery, and a QR-code handover for local
-- collection. Both still leave the existing manual "Confirm Receipt"
-- button and the 14-day shipped_at fallback untouched.

alter table public.order_deliveries add column tracking_status text
  check (tracking_status in ('pending', 'in_transit', 'delivered'));
alter table public.order_deliveries add column delivered_at timestamptz;
alter table public.order_deliveries add column handover_token text;
alter table public.order_deliveries add column handover_token_expires_at timestamptz;

alter table public.orders drop constraint orders_transfer_released_by_check;
alter table public.orders add constraint orders_transfer_released_by_check
  check (transfer_released_by in ('buyer_confirmed', 'auto_release', 'admin', 'delivery_timeout'));

-- A 48-hour SLA checked only once a day (the original schedule) could slip
-- by up to 24 hours — hourly keeps every timer in auto-release-transfers
-- (this new one, plus the existing 11-day reminder and 14-day release)
-- accurate to within about an hour.
select cron.unschedule('auto-release-transfers');
select
  cron.schedule(
    'auto-release-transfers',
    '0 * * * *',
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
