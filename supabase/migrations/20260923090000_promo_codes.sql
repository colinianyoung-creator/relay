-- "First 100 sellers list free" launch promo. One redemption per person,
-- hard-capped at 100 total — enforced here, not trusted to the client,
-- since listings.fee_status itself already has no column-level RLS guard
-- (an existing trust gap this doesn't widen: a client could already insert
-- fee_status = 'exempt' directly on any listing today). What this promo
-- adds is an authoritative, race-safe count of how many people have
-- actually claimed the offer.
create table public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (code, user_id)
);

create index idx_promo_redemptions_code on public.promo_redemptions(code);

alter table public.promo_redemptions enable row level security;

-- No insert/update/delete policy for regular users — every write goes
-- through redeem_promo_code() below, which is the only place the 100-cap
-- and the specific active code are actually enforced.
create policy "Users can view their own promo redemptions"
  on public.promo_redemptions for select
  using (auth.uid() = user_id);

-- Idempotent (returns true again for someone who already redeemed) and
-- race-safe (pg_advisory_xact_lock serializes concurrent redeemers of the
-- same code before the count check, so two simultaneous requests can't both
-- slip in as the "100th" claim). The valid code and its cap are hardcoded
-- rather than data-driven — this is one specific launch promotion, not a
-- general coupon engine.
create or replace function public.redeem_promo_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_cap constant int := 100;
  v_count int;
  v_already boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if v_code <> 'RELAY100' then
    return false;
  end if;

  select exists(
    select 1 from promo_redemptions where code = v_code and user_id = auth.uid()
  ) into v_already;
  if v_already then
    return true;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_code));

  select count(*) into v_count from promo_redemptions where code = v_code;
  if v_count >= v_cap then
    return false;
  end if;

  insert into promo_redemptions (code, user_id) values (v_code, auth.uid());
  return true;
end;
$$;

grant execute on function public.redeem_promo_code(text) to authenticated;

-- Public, read-only claim count for the banner — promo_redemptions itself
-- stays private to each redeemer, this just exposes the tally.
create or replace function public.promo_redemption_count(p_code text)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from promo_redemptions where code = upper(trim(p_code));
$$;

grant execute on function public.promo_redemption_count(text) to anon, authenticated;
