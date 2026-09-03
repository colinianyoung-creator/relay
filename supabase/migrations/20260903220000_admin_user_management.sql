-- Building admin user management (verify/ban/promote) surfaced the same gap
-- for profiles.verified that is_admin had: "Users can update their own
-- profile" has no column restriction, so any signed-in user could currently
-- set their own verified = true via a normal profile update. Same fix,
-- extended to cover both columns with one trigger.
drop trigger if exists protect_is_admin on public.profiles;
drop function if exists public.protect_is_admin_column();

create function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := current_setting('request.jwt.claims', true)::json->>'role';
  is_privileged_caller boolean := jwt_role is not null and jwt_role <> 'service_role';
begin
  if is_privileged_caller then
    if new.is_admin is distinct from old.is_admin then
      new.is_admin := old.is_admin;
    end if;
    if new.verified is distinct from old.verified then
      new.verified := old.verified;
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_privileged_profile_columns
  before update on public.profiles
  for each row execute function public.protect_privileged_profile_columns();
