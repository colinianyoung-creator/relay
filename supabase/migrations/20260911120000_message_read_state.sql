-- The Messages tab badge counted total threads, not unread ones — it never
-- cleared after actually reading a conversation. Add real read tracking:
-- null means unread, set the moment the recipient opens that thread.

alter table public.messages add column read_at timestamptz;

-- Only the recipient can mark a message of theirs as read.
create policy "Recipient can mark their own messages read"
  on public.messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);
