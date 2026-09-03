-- The previous fix checked request.jwt.claims for 'service_role', but that
-- GUC is unset for direct SQL (Supabase SQL editor, Management API) too —
-- not just for legitimate privileged access — which silently blocked the
-- normal way of granting someone admin in the first place. The reliable
-- signal is the Postgres session role itself: PostgREST executes ordinary
-- signed-in requests as `authenticated`, and switches to `service_role` or
-- a privileged role (`postgres`, direct SQL) for anything else. Block only
-- the `authenticated` path — that's the one a self-promotion attempt from
-- the app would use.
create or replace function public.protect_is_admin_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin then
    if current_user = 'authenticated' then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;
