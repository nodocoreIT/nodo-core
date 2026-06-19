-- Allow admins to update their concesionaria (clientes row).
-- Fixes 406 on PATCH when RLS blocked updates (002 used missing get_my_cliente_id()).

alter table public.clientes
  add column if not exists theme_settings jsonb default null;

drop policy if exists "clientes: admin update own" on public.clientes;

create policy "clientes: admin update own"
  on public.clientes
  for update
  to authenticated
  using (
    id in (select cliente_id from public.users where id = auth.uid())
  )
  with check (
    id in (select cliente_id from public.users where id = auth.uid())
  );

-- nodo_autos schema (local dev)
alter table if exists nodo_autos.clientes
  add column if not exists theme_settings jsonb default null;

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
