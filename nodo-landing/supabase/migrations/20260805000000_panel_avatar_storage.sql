-- Personal avatar uploads for the NODO Core panel — reuses the existing
-- private "panel-branding" bucket (already scoped to team members via
-- panel_branding_team_select), but adds write policies scoped to
-- avatars/{auth.uid()}/... so each person can only write their OWN avatar,
-- unlike the org-wide "default/" logo folder where any team member can
-- write.

create policy panel_branding_own_avatar_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'panel-branding'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy panel_branding_own_avatar_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'panel-branding'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'panel-branding'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy panel_branding_own_avatar_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'panel-branding'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- Read stays covered by the existing panel_branding_team_select policy
-- (any team member, whole bucket) — teammates seeing each other's avatar
-- in the Equipo list / Sidebar is the point.
