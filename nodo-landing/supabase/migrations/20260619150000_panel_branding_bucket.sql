-- Private bucket for Nodo Core dashboard logos (sidebar + PDF).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'panel-branding',
  'panel-branding',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists panel_branding_team_select on storage.objects;
drop policy if exists panel_branding_team_insert on storage.objects;
drop policy if exists panel_branding_team_update on storage.objects;
drop policy if exists panel_branding_team_delete on storage.objects;

create policy panel_branding_team_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'panel-branding'
    and (select nodo_core.is_team_member())
  );

create policy panel_branding_team_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'panel-branding'
    and (storage.foldername(name))[1] = 'default'
    and (select nodo_core.is_team_member())
  );

create policy panel_branding_team_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'panel-branding'
    and (storage.foldername(name))[1] = 'default'
    and (select nodo_core.is_team_member())
  )
  with check (
    bucket_id = 'panel-branding'
    and (storage.foldername(name))[1] = 'default'
    and (select nodo_core.is_team_member())
  );

create policy panel_branding_team_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'panel-branding'
    and (storage.foldername(name))[1] = 'default'
    and (select nodo_core.is_team_member())
  );
