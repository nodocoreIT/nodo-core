-- Add theme_settings column to nodo_autos.clientes
alter table nodo_autos.clientes
  add column if not exists theme_settings jsonb default null;

-- Allow admins to update their own cliente row (theme + branding)
create policy "clientes: admin update own"
  on nodo_autos.clientes
  for update to authenticated
  using (id = public.get_my_cliente_id())
  with check (id = public.get_my_cliente_id());
