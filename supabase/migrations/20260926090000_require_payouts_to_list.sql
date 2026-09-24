-- Every priced listing must come from a seller who's finished Stripe Connect
-- onboarding, so every sale can be paid in-app. Free/donated listings
-- (price is null) are exempt — there's nothing to pay out. The create-listing
-- pages already gate on this in the UI; this closes the same client-bypass
-- gap as protect_listing_fee_status, with the same shape: a trigger gated on
-- request.jwt.claims so service_role (edge functions) and direct SQL are
-- unaffected. INSERT only — editing an existing listing isn't blocked.
create or replace function public.require_payouts_for_priced_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := current_setting('request.jwt.claims', true)::json->>'role';
  payouts_ready boolean;
begin
  if jwt_role is null or jwt_role = 'service_role' then
    return new;
  end if;
  if new.price is null then
    return new;
  end if;

  select coalesce(stripe_connect_charges_enabled, false)
    into payouts_ready
    from profiles
   where id = new.seller_id;

  if not coalesce(payouts_ready, false) then
    raise exception 'Set up payouts before listing an item for sale.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger require_payouts_for_priced_listing
  before insert on public.listings
  for each row execute function public.require_payouts_for_priced_listing();
