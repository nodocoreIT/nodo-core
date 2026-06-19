-- Multi-tenant: each authenticated user sees only their rows (user_id = auth.uid()).
-- cotizaciones_dolar stays shared (FX cache for all users).

-- ── user_id column ───────────────────────────────────────────────────────────

alter table nodo_finanzas_personales.cuentas
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table nodo_finanzas_personales.rubros
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table nodo_finanzas_personales.gastos_fijos
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table nodo_finanzas_personales.tarjetas
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table nodo_finanzas_personales.tarjetas_consumos
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table nodo_finanzas_personales.gastos_diarios
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table nodo_finanzas_personales.prestamos
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table nodo_finanzas_personales.cuotas_programadas
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table nodo_finanzas_personales.planes_ahorro
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table nodo_finanzas_personales.cuotas_planes_ahorro
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table nodo_finanzas_personales.cuentas_bancarias
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table nodo_finanzas_personales.movimientos_cuenta
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table nodo_finanzas_personales.sueldos
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table nodo_finanzas_personales.categorias
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table nodo_finanzas_personales.configuracion_usuario
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- configuracion: clave was globally unique → per user
alter table nodo_finanzas_personales.configuracion_usuario
  drop constraint if exists configuracion_usuario_clave_key;

create unique index if not exists configuracion_usuario_user_clave_idx
  on nodo_finanzas_personales.configuracion_usuario (user_id, clave);

-- ── indexes ──────────────────────────────────────────────────────────────────

create index if not exists cuentas_user_id_idx on nodo_finanzas_personales.cuentas (user_id);
create index if not exists rubros_user_id_idx on nodo_finanzas_personales.rubros (user_id);
create index if not exists gastos_diarios_user_id_idx on nodo_finanzas_personales.gastos_diarios (user_id);
create index if not exists tarjetas_user_id_idx on nodo_finanzas_personales.tarjetas (user_id);
create index if not exists prestamos_user_id_idx on nodo_finanzas_personales.prestamos (user_id);

-- ── RLS: replace open policies ───────────────────────────────────────────────

do $$
declare
  t text;
  tables text[] := array[
    'cuentas', 'rubros', 'gastos_fijos', 'tarjetas', 'tarjetas_consumos',
    'gastos_diarios', 'prestamos', 'cuotas_programadas', 'planes_ahorro',
    'cuotas_planes_ahorro', 'cuentas_bancarias', 'movimientos_cuenta',
    'sueldos', 'categorias', 'configuracion_usuario'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "authenticated_all" on nodo_finanzas_personales.%I', t);
    execute format(
      'create policy "tenant_select" on nodo_finanzas_personales.%I for select to authenticated using (user_id = auth.uid())',
      t
    );
    execute format(
      'create policy "tenant_insert" on nodo_finanzas_personales.%I for insert to authenticated with check (user_id = auth.uid())',
      t
    );
    execute format(
      'create policy "tenant_update" on nodo_finanzas_personales.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
    execute format(
      'create policy "tenant_delete" on nodo_finanzas_personales.%I for delete to authenticated using (user_id = auth.uid())',
      t
    );
  end loop;
end $$;

-- cotizaciones_dolar: shared FX cache (any authenticated user)
-- policy "authenticated_all" remains unchanged on that table.

-- ── Backfill existing rows (run manually after migration if needed) ────────────
-- update nodo_finanzas_personales.cuentas set user_id = '<auth-users-uuid>' where user_id is null;
-- repeat for each table, respecting FK order (parents before children).
