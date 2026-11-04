-- The first feedback migration granted UPDATE on status only, but this project's
-- default privileges had already given authenticated full table UPDATE, so an
-- admin could also rewrite message text. Strip everything, then re-grant the
-- minimum: admins (via RLS) may read rows and change only the status.
revoke all on public.feedback_submissions from anon, authenticated;
grant select on public.feedback_submissions to authenticated;
grant update (status) on public.feedback_submissions to authenticated;
