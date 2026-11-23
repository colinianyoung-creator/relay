-- A record of what each person agreed to, and when: acceptance of the Terms at
-- sign-up, and explicit consent to the fit profile's health-related fields
-- (special category data under UK GDPR). Rows are only ever written through
-- the two functions below, so the client can't forge or edit them.
create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null check (purpose in ('terms', 'fit_profile')),
  -- Which version of the Terms / Privacy Policy wording they saw.
  policy_version text not null,
  -- Where it was given, e.g. 'signup_email', 'signup_google', 'fit_profile_form'.
  source text not null,
  given_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_reason text check (ended_reason in ('withdrawn', 'superseded')),
  check ((ended_at is null) = (ended_reason is null))
);

-- At most one live consent per person per purpose; history stays as ended rows.
create unique index idx_user_consents_one_active
  on public.user_consents(user_id, purpose) where ended_at is null;
create index idx_user_consents_user on public.user_consents(user_id);

alter table public.user_consents enable row level security;

create policy "Users can view their own consents"
  on public.user_consents for select
  using (auth.uid() = user_id);

-- This project's default privileges hand new tables to the API roles, so
-- strip everything first and re-grant only reading your own rows.
revoke all on public.user_consents from anon, authenticated;
grant select on public.user_consents to authenticated;
grant all on public.user_consents to service_role;

-- Record (or renew) a consent. No-op if the same version is already live; a
-- newer version ends the old row as 'superseded'. p_given_at lets a consent
-- ticked at sign-up keep its real time when it is only recorded after the
-- email is confirmed, clamped so it can't predate the account or be future.
create or replace function public.record_consent(
  p_purpose text,
  p_version text,
  p_source text,
  p_given_at timestamptz default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_created timestamptz;
  v_given timestamptz;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_purpose not in ('terms', 'fit_profile') then
    raise exception 'Unknown consent purpose';
  end if;

  if exists (
    select 1 from public.user_consents
    where user_id = v_user and purpose = p_purpose
      and ended_at is null and policy_version = p_version
  ) then
    return;
  end if;

  select created_at into v_created from auth.users where id = v_user;
  v_given := least(coalesce(p_given_at, now()), now());
  v_given := greatest(v_given, coalesce(v_created, v_given));

  update public.user_consents
    set ended_at = now(), ended_reason = 'superseded'
    where user_id = v_user and purpose = p_purpose and ended_at is null;

  insert into public.user_consents (user_id, purpose, policy_version, source, given_at)
  values (v_user, p_purpose, p_version, p_source, v_given);
end;
$$;

create or replace function public.withdraw_consent(p_purpose text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update public.user_consents
    set ended_at = now(), ended_reason = 'withdrawn'
    where user_id = auth.uid() and purpose = p_purpose and ended_at is null;
end;
$$;

revoke all on function public.record_consent(text, text, text, timestamptz) from public, anon;
revoke all on function public.withdraw_consent(text) from public, anon;
grant execute on function public.record_consent(text, text, text, timestamptz) to authenticated;
grant execute on function public.withdraw_consent(text) to authenticated;
