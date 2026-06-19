-- Add theme_settings column to nodo_autos.clientes
alter table nodo_autos.clientes
  add column if not exists theme_settings jsonb default null;

-- Allow admins to update their own cliente row (theme + branding).
drop policy if exists "clientes: admin update own" on nodo_autos.clientes;

create policy "clientes: admin update own"
  on nodo_autos.clientes
  for update
  to authenticated
  using (
    id in (select cliente_id from nodo_autos.users where id = auth.uid())
  )
  with check (
    id in (select cliente_id from nodo_autos.users where id = auth.uid())
  );
