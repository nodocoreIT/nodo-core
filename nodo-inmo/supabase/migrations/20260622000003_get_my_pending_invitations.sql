-- Returns pending invitation tokens for the current user.
-- Used by the client to auto-accept invitations on login.
create or replace function public.get_my_pending_invitations()
returns table(token uuid)
language sql
security definer
stable
set search_path = ''
as $$
  select i.token
  from shared.org_invitations i
  where i.invitee_user_id = auth.uid()
    and i.status = 'pending'
    and i.expires_at > now();
$$;

revoke execute on function public.get_my_pending_invitations() from public;
grant execute on function public.get_my_pending_invitations() to authenticated;
