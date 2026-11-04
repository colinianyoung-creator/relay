-- Beta feedback from the site's Feedback button. Anyone can send it, signed in
-- or not, so there is deliberately no insert policy: the submit-feedback edge
-- function writes with the service role after rate-limiting and spam checks.
create table public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  message text not null check (char_length(message) between 1 and 2000),
  contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  page_path text check (page_path is null or char_length(page_path) <= 200),
  viewport text check (viewport is null or char_length(viewport) <= 20),
  -- Salted hash, only used to rate-limit anonymous senders; never the raw IP.
  sender_hash text,
  status text not null default 'new' check (status in ('new', 'resolved')),
  created_at timestamptz not null default now()
);

create index idx_feedback_status_created on public.feedback_submissions(status, created_at desc);
create index idx_feedback_sender_created on public.feedback_submissions(sender_hash, created_at);

alter table public.feedback_submissions enable row level security;

create policy "Admins can view feedback"
  on public.feedback_submissions for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

create policy "Admins can update feedback status"
  on public.feedback_submissions for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

grant select, update (status) on public.feedback_submissions to authenticated;
grant all on public.feedback_submissions to service_role;
