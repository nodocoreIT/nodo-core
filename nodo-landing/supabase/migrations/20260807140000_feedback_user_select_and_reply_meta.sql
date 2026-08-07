-- Allow authenticated users to read their own shared.feedback rows so the
-- floating "nodito" can show Q&A history (question + Nodo reply/status).
-- Replies are stored in metadata.replies (jsonb) by the panel admin API —
-- no new table; shared.feedback schema stays additive via metadata only.

grant usage on schema shared to authenticated;
grant select on table shared.feedback to authenticated;

drop policy if exists "users read own feedback" on shared.feedback;
create policy "users read own feedback"
  on shared.feedback
  for select
  to authenticated
  using (user_id = (select auth.uid()));
