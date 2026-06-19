-- Settings profile fields + branding storage for nodo-autos (public.clientes)

alter table public.clientes
  add column if not exists legal_name text,
  add column if not exists cuit text,
  add column if not exists logo_path text,
  add column if not exists pdf_logo_path text,
  add column if not exists alert_settings jsonb default '{"contractExpirationMonths":2,"rentAdjustmentMonths":1}'::jsonb;

alter table if exists nodo_autos.clientes
  add column if not exists legal_name text,
  add column if not exists cuit text,
  add column if not exists logo_path text,
  add column if not exists pdf_logo_path text,
  add column if not exists alert_settings jsonb default '{"contractExpirationMonths":2,"rentAdjustmentMonths":1}'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cliente-branding',
  'cliente-branding',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "cliente_branding_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cliente-branding'
    and (storage.foldername(name))[1] in (
      select cliente_id::text from public.users where id = auth.uid()
    )
  );

create policy "cliente_branding_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cliente-branding'
    and (storage.foldername(name))[1] in (
      select cliente_id::text from public.users where id = auth.uid()
    )
  );

create policy "cliente_branding_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cliente-branding'
    and (storage.foldername(name))[1] in (
      select cliente_id::text from public.users where id = auth.uid()
    )
  )
  with check (
    bucket_id = 'cliente-branding'
    and (storage.foldername(name))[1] in (
      select cliente_id::text from public.users where id = auth.uid()
    )
  );

create policy "cliente_branding_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cliente-branding'
    and (storage.foldername(name))[1] in (
      select cliente_id::text from public.users where id = auth.uid()
    )
  );

-- Allow admins to update roles of users in same cliente
drop policy if exists "users: admin update same cliente" on public.users;
create policy "users: admin update same cliente"
  on public.users for update
  to authenticated
  using (
    cliente_id in (select cliente_id from public.users where id = auth.uid())
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'administrador'
    )
  )
  with check (
    cliente_id in (select cliente_id from public.users where id = auth.uid())
  );

drop policy if exists "users: admin update same cliente" on nodo_autos.users;
create policy "users: admin update same cliente"
  on nodo_autos.users for update
  to authenticated
  using (
    cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid())
    and exists (
      select 1 from nodo_autos.users u
      where u.id = auth.uid() and u.role = 'administrador'
    )
  )
  with check (
    cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid())
  );
