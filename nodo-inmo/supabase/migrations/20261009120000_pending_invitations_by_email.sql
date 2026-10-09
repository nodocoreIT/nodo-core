-- Pending invites must match by email too: generateLink sets invitee_user_id,
-- but a later login still needs to find the row if ids ever diverge.
create or replace function public.get_my_pending_invitations()
returns table(token uuid)
language sql
security definer
stable
set search_path = ''
as $$
  select i.token
  from shared.org_invitations i
  where i.status = 'pending'
    and i.expires_at > now()
    and (
      i.invitee_user_id = auth.uid()
      or lower(i.invitee_email) = (
        select lower(u.email)
        from auth.users u
        where u.id = auth.uid()
      )
    );
$$;

revoke execute on function public.get_my_pending_invitations() from public;
grant execute on function public.get_my_pending_invitations() to authenticated;
