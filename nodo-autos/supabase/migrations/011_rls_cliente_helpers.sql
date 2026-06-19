-- Fix infinite RLS recursion (42P17) on nodo_autos.users:
-- clientes policies read users, users policies read users again.
-- Helper functions run as definer and bypass RLS for the lookup only.

create or replace function nodo_autos.get_my_cliente_id()
returns uuid
language sql
stable
security definer
set search_path = nodo_autos, public
as $$
  select u.cliente_id
  from nodo_autos.users u
  where u.id = (select auth.uid())
  limit 1;
$$;

create or replace function nodo_autos.get_my_role()
returns text
language sql
stable
security definer
set search_path = nodo_autos, public
as $$
  select u.role
  from nodo_autos.users u
  where u.id = (select auth.uid())
  limit 1;
$$;

revoke all on function nodo_autos.get_my_cliente_id() from public, anon;
grant execute on function nodo_autos.get_my_cliente_id() to authenticated, service_role;

revoke all on function nodo_autos.get_my_role() from public, anon;
grant execute on function nodo_autos.get_my_role() to authenticated, service_role;

-- ─── clientes ────────────────────────────────────────────────────────────────

drop policy if exists "clientes: read own" on nodo_autos.clientes;
create policy "clientes: read own"
  on nodo_autos.clientes for select
  to authenticated
  using (id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "clientes: admin update own" on nodo_autos.clientes;
create policy "clientes: admin update own"
  on nodo_autos.clientes for update
  to authenticated
  using (id = (select nodo_autos.get_my_cliente_id()))
  with check (id = (select nodo_autos.get_my_cliente_id()));

-- ─── users ───────────────────────────────────────────────────────────────────

drop policy if exists "users: read same cliente" on nodo_autos.users;
create policy "users: read same cliente"
  on nodo_autos.users for select
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "users: update own profile" on nodo_autos.users;
create policy "users: update own profile"
  on nodo_autos.users for update
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists "users: admin update same cliente" on nodo_autos.users;
create policy "users: admin update same cliente"
  on nodo_autos.users for update
  to authenticated
  using (
    cliente_id = (select nodo_autos.get_my_cliente_id())
    and (select nodo_autos.get_my_role()) = 'administrador'
  )
  with check (cliente_id = (select nodo_autos.get_my_cliente_id()));

-- ─── vehicles ────────────────────────────────────────────────────────────────

drop policy if exists "vehicles: read" on nodo_autos.vehicles;
create policy "vehicles: read"
  on nodo_autos.vehicles for select
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "vehicles: insert" on nodo_autos.vehicles;
create policy "vehicles: insert"
  on nodo_autos.vehicles for insert
  to authenticated
  with check (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "vehicles: update" on nodo_autos.vehicles;
create policy "vehicles: update"
  on nodo_autos.vehicles for update
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "vehicles: delete" on nodo_autos.vehicles;
create policy "vehicles: delete"
  on nodo_autos.vehicles for delete
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

-- ─── publications ────────────────────────────────────────────────────────────

drop policy if exists "publications: read" on nodo_autos.publications;
create policy "publications: read"
  on nodo_autos.publications for select
  to authenticated
  using (
    vehicle_id in (
      select v.id from nodo_autos.vehicles v
      where v.cliente_id = (select nodo_autos.get_my_cliente_id())
    )
  );

drop policy if exists "publications: insert" on nodo_autos.publications;
create policy "publications: insert"
  on nodo_autos.publications for insert
  to authenticated
  with check (
    vehicle_id in (
      select v.id from nodo_autos.vehicles v
      where v.cliente_id = (select nodo_autos.get_my_cliente_id())
    )
  );

drop policy if exists "publications: update" on nodo_autos.publications;
create policy "publications: update"
  on nodo_autos.publications for update
  to authenticated
  using (
    vehicle_id in (
      select v.id from nodo_autos.vehicles v
      where v.cliente_id = (select nodo_autos.get_my_cliente_id())
    )
  );

-- ─── customers ───────────────────────────────────────────────────────────────

drop policy if exists "customers: read" on nodo_autos.customers;
create policy "customers: read"
  on nodo_autos.customers for select
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "customers: insert" on nodo_autos.customers;
create policy "customers: insert"
  on nodo_autos.customers for insert
  to authenticated
  with check (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "customers: update" on nodo_autos.customers;
create policy "customers: update"
  on nodo_autos.customers for update
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "customers: delete" on nodo_autos.customers;
create policy "customers: delete"
  on nodo_autos.customers for delete
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

-- ─── contracts ───────────────────────────────────────────────────────────────

drop policy if exists "contracts: read" on nodo_autos.contracts;
create policy "contracts: read"
  on nodo_autos.contracts for select
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "contracts: insert" on nodo_autos.contracts;
create policy "contracts: insert"
  on nodo_autos.contracts for insert
  to authenticated
  with check (cliente_id = (select nodo_autos.get_my_cliente_id()));

-- ─── audit_logs ──────────────────────────────────────────────────────────────

drop policy if exists "audit_logs: read (admins only)" on nodo_autos.audit_logs;
create policy "audit_logs: read (admins only)"
  on nodo_autos.audit_logs for select
  to authenticated
  using (
    cliente_id = (select nodo_autos.get_my_cliente_id())
    and (select nodo_autos.get_my_role()) = 'administrador'
  );

drop policy if exists "audit_logs: insert" on nodo_autos.audit_logs;
create policy "audit_logs: insert"
  on nodo_autos.audit_logs for insert
  to authenticated
  with check (cliente_id = (select nodo_autos.get_my_cliente_id()));

-- ─── agenda / caja module tables ─────────────────────────────────────────────

drop policy if exists "tasks: read" on nodo_autos.tasks;
create policy "tasks: read" on nodo_autos.tasks for select
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "tasks: insert" on nodo_autos.tasks;
create policy "tasks: insert" on nodo_autos.tasks for insert
  to authenticated
  with check (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "tasks: update" on nodo_autos.tasks;
create policy "tasks: update" on nodo_autos.tasks for update
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "tasks: delete" on nodo_autos.tasks;
create policy "tasks: delete" on nodo_autos.tasks for delete
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "cash_movements: read" on nodo_autos.cash_movements;
create policy "cash_movements: read" on nodo_autos.cash_movements for select
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "cash_movements: insert" on nodo_autos.cash_movements;
create policy "cash_movements: insert" on nodo_autos.cash_movements for insert
  to authenticated
  with check (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "cash_movements: update" on nodo_autos.cash_movements;
create policy "cash_movements: update" on nodo_autos.cash_movements for update
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "cash_movements: delete" on nodo_autos.cash_movements;
create policy "cash_movements: delete" on nodo_autos.cash_movements for delete
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "conceptos: read" on nodo_autos.conceptos;
create policy "conceptos: read" on nodo_autos.conceptos for select
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "conceptos: insert" on nodo_autos.conceptos;
create policy "conceptos: insert" on nodo_autos.conceptos for insert
  to authenticated
  with check (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "cash_accounts: read" on nodo_autos.cash_accounts;
create policy "cash_accounts: read" on nodo_autos.cash_accounts for select
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "cash_accounts: insert" on nodo_autos.cash_accounts;
create policy "cash_accounts: insert" on nodo_autos.cash_accounts for insert
  to authenticated
  with check (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "cash_accounts: update" on nodo_autos.cash_accounts;
create policy "cash_accounts: update" on nodo_autos.cash_accounts for update
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()))
  with check (cliente_id = (select nodo_autos.get_my_cliente_id()));

drop policy if exists "cash_accounts: delete" on nodo_autos.cash_accounts;
create policy "cash_accounts: delete" on nodo_autos.cash_accounts for delete
  to authenticated
  using (cliente_id = (select nodo_autos.get_my_cliente_id()));

-- ─── branding storage ──────────────────────────────────────────────────────────

drop policy if exists "cliente_branding_select" on storage.objects;
create policy "cliente_branding_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'cliente-branding'
    and (storage.foldername(name))[1] = (select nodo_autos.get_my_cliente_id())::text
  );

drop policy if exists "cliente_branding_insert" on storage.objects;
create policy "cliente_branding_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'cliente-branding'
    and (storage.foldername(name))[1] = (select nodo_autos.get_my_cliente_id())::text
  );

drop policy if exists "cliente_branding_update" on storage.objects;
create policy "cliente_branding_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'cliente-branding'
    and (storage.foldername(name))[1] = (select nodo_autos.get_my_cliente_id())::text
  )
  with check (
    bucket_id = 'cliente-branding'
    and (storage.foldername(name))[1] = (select nodo_autos.get_my_cliente_id())::text
  );

drop policy if exists "cliente_branding_delete" on storage.objects;
create policy "cliente_branding_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'cliente-branding'
    and (storage.foldername(name))[1] = (select nodo_autos.get_my_cliente_id())::text
  );
