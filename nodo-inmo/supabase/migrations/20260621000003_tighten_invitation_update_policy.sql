-- Tighten invitee update policy — only allow status changes to accepted/rejected.
-- The previous policy's with check only re-validated invitee_user_id ownership,
-- leaving all other columns (role, token, expires_at, etc.) unprotected against
-- modification by the invitee.
drop policy if exists "invitations_invitee_update" on shared.org_invitations;

create policy "invitations_invitee_update" on shared.org_invitations
  for update to authenticated
  using (
    invitee_user_id = (select auth.uid())
    and status = 'pending'
  )
  with check (
    invitee_user_id = (select auth.uid())
    and status in ('accepted', 'rejected')
  );
