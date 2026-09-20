-- listings.fee_status has no column-level RLS guard — the "Users can
-- insert/update their own listings" policies only check seller_id, so an
-- ordinary signed-in client could already POST fee_status = 'exempt'
-- directly on a priced listing (or PATCH an existing 'pending' one to
-- 'exempt'/'paid'), skipping the £9 posting fee entirely. App code has
-- always been trusted to set this column correctly instead.
--
-- Same fix shape as protect_is_admin_column() (see
-- 20260903210000_fix_protect_is_admin_v2.sql — verified there against a
-- real signed-in user's JWT, not just simulated in raw SQL): a trigger,
-- not RLS or a column-level REVOKE (Supabase's default table-wide grants
-- make a plain REVOKE ineffective), gated on request.jwt.claims so it
-- only constrains the Data API path an app client actually uses —
-- service_role (stripe-webhook) and direct SQL are unaffected.
create or replace function public.protect_listing_fee_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := current_setting('request.jwt.claims', true)::json->>'role';
  has_promo boolean;
begin
  if jwt_role is null or jwt_role = 'service_role' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Nothing legitimately changes fee_status after insert from this path
    -- — 'pending' -> 'paid' only ever happens via stripe-webhook's
    -- service_role update, already exempted above.
    if new.fee_status is distinct from old.fee_status then
      new.fee_status := old.fee_status;
    end if;
    return new;
  end if;

  -- INSERT: 'paid' is never legitimate here (only the webhook sets that).
  -- 'exempt' is only legitimate for a free/donation listing (price is
  -- null), a club-gear/fleet item (createFleetListing always posts these
  -- fee-exempt, priced or not — see supabaseData.ts), or a redeemed
  -- RELAY100 launch-promo claim. Anything else collapses to 'pending' so
  -- the normal Stripe fee flow still applies instead of silently failing.
  if new.fee_status = 'paid' then
    new.fee_status := 'pending';
  elsif new.fee_status = 'exempt' and new.price is not null and new.bundle_id is null then
    select exists(
      select 1 from promo_redemptions where user_id = auth.uid() and code = 'RELAY100'
    ) into has_promo;
    if not has_promo then
      new.fee_status := 'pending';
    end if;
  end if;

  return new;
end;
$$;

create trigger protect_listing_fee_status
  before insert or update on public.listings
  for each row execute function public.protect_listing_fee_status();
