-- The previous migration's `revoke update (is_admin) ... from authenticated`
-- doesn't actually work: Supabase's default schema grants give
-- `authenticated` table-wide UPDATE on profiles, and in Postgres a
-- table-level grant overrides a column-level revoke. That left is_admin
-- self-promotable via the ordinary "Users can update their own profile" RLS
-- policy, which has no column restriction. A trigger isn't affected by
-- grant precedence and is the reliable way to protect this column.
create function public.protect_is_admin_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin then
    if coalesce(current_setting('request.jwt.claims', true)::json->>'role', '') <> 'service_role' then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_is_admin
  before update on public.profiles
  for each row execute function public.protect_is_admin_column();
