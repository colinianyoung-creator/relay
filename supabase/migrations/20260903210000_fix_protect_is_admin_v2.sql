-- Second attempt, and this time verified against a real signed-in user's
-- JWT via the REST API, not just simulated in raw SQL:
--
-- Supabase's Data API (PostgREST) does NOT switch the Postgres session role
-- per request — current_user is the same regardless of caller, so the
-- previous migration's `current_user = 'authenticated'` check never
-- matched anything and left is_admin completely unprotected (confirmed: a
-- real user's own access token successfully PATCHed their own is_admin to
-- true). Authorization instead flows through the `request.jwt.claims` GUC,
-- read here directly rather than via current_user.
--
-- The correct distinction: a request through the Data API always has JWT
-- claims set (role = 'authenticated', 'anon', or 'service_role'); a direct
-- SQL session (Management API, SQL editor) has no JWT claims at all. Block
-- the change only when JWT claims are present and the role isn't
-- service_role — that covers real user/anon requests while leaving direct
-- privileged SQL (how an admin actually gets promoted) unaffected.
create or replace function public.protect_is_admin_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := current_setting('request.jwt.claims', true)::json->>'role';
begin
  if new.is_admin is distinct from old.is_admin then
    if jwt_role is not null and jwt_role <> 'service_role' then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;
