-- ============================================================
-- nodo_finanzas_personales — Initial Schema (auth required)
-- ============================================================

-- 1. Schema
create schema if not exists nodo_finanzas_personales;
grant usage on schema nodo_finanzas_personales to authenticated, service_role;

-- ============================================================
-- Tables
-- ============================================================

-- 1. cuentas (accounts: cash, bank, credit, virtual)
create table nodo_finanzas_personales.cuentas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('EFECTIVO', 'CAJA_AHORRO', 'CUENTA_CORRIENTE', 'VIRTUAL')),
  saldo_actual numeric(14,2) not null default 0,
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  activa boolean not null default true,
  fecha_actualizacion timestamptz,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

-- 2. rubros (expense categories)
create table nodo_finanzas_personales.rubros (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nombre text not null,
  emoji text,
  color text,
  descripcion text,
  activo boolean not null default true,
  es_sistema boolean not null default false,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. gastos_fijos (fixed recurring expenses)
create table nodo_finanzas_personales.gastos_fijos (
  id uuid primary key default gen_random_uuid(),
  rubro_id uuid references nodo_finanzas_personales.rubros(id),
  etiqueta text,
  descripcion text not null,
  monto numeric(14,2) not null,
  moneda text not null default 'ARS',
  forma_de_pago text not null,
  tarjeta_id uuid,
  cuenta_bancaria_id uuid,
  plan_id uuid,
  prestamo_id uuid,
  pago_tarjeta_id uuid,
  activo boolean not null default true,
  fecha_creacion timestamptz,
  created_at timestamptz not null default now()
);

-- 4. tarjetas (credit cards)
create table nodo_finanzas_personales.tarjetas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  banco text not null,
  tipo text not null check (tipo in ('VISA', 'MASTERCARD', 'AMEX')),
  titular text,
  dia_cierre int not null,
  dia_vencimiento int not null,
  limite_credito numeric(14,2),
  limite_recomendado numeric(14,2),
  fecha_vencimiento text,
  pagada boolean not null default false,
  ultimo_pago_mes text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

-- 5. tarjetas_consumos (credit card transactions)
create table nodo_finanzas_personales.tarjetas_consumos (
  id uuid primary key default gen_random_uuid(),
  tarjeta_id uuid not null references nodo_finanzas_personales.tarjetas(id) on delete cascade,
  fecha date not null,
  lugar text not null,
  rubro text,
  rubro_id uuid references nodo_finanzas_personales.rubros(id),
  detalle text,
  importe_ars numeric(14,2) not null default 0,
  importe_usd numeric(14,4),
  cuotas text,
  cuota_actual int not null default 1,
  total_cuotas int not null default 1,
  gasto_fijo boolean not null default false,
  codigo_operacion text,
  fecha_compra date,
  created_at timestamptz not null default now()
);

-- 6. gastos_diarios (daily expenses)
create table nodo_finanzas_personales.gastos_diarios (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null,
  detalle text,
  monto numeric(14,2) not null,
  monto_usd numeric(14,4),
  fecha date not null default current_date,
  rubro text,
  rubro_id uuid references nodo_finanzas_personales.rubros(id),
  forma_de_pago text not null,
  tarjeta_id uuid references nodo_finanzas_personales.tarjetas(id),
  cuenta_id uuid references nodo_finanzas_personales.cuentas(id),
  cuotas int not null default 1,
  codigo_operacion text,
  gasto_fijo_id uuid references nodo_finanzas_personales.gastos_fijos(id),
  plan_id uuid,
  prestamo_id uuid,
  pago_tarjeta_id uuid,
  pago_parcial boolean not null default false,
  pago_tarjeta_mes text,
  es_silencioso boolean not null default false,
  created_at timestamptz not null default now()
);

-- 7. prestamos (loans)
create table nodo_finanzas_personales.prestamos (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  monto_original numeric(14,2) not null,
  moneda text not null default 'ARS',
  saldo_pendiente numeric(14,2) not null,
  tasa_interes numeric(8,4),
  fecha_inicio date,
  fecha_vencimiento date,
  cuotas_totales int,
  cuotas_pagas int not null default 0,
  importe_cuota numeric(14,2),
  saldo_cancelacion numeric(14,2),
  cuota_abonada boolean not null default false,
  pagado boolean not null default false,
  activo boolean not null default true,
  prestamista text,
  color text,
  no_cobrar_cuota boolean not null default false,
  notas text,
  comprobante_url text,
  ultimo_pago_mes text,
  created_at timestamptz not null default now()
);

-- 8. cuotas_programadas (scheduled loan installments)
create table nodo_finanzas_personales.cuotas_programadas (
  id uuid primary key default gen_random_uuid(),
  prestamo_id uuid not null references nodo_finanzas_personales.prestamos(id) on delete cascade,
  numero_cuota int not null,
  fecha_vencimiento date not null,
  importe_total numeric(14,2) not null,
  pagada boolean not null default false,
  fecha_pago date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 9. planes_ahorro (Argentine auto-savings plans)
create table nodo_finanzas_personales.planes_ahorro (
  id uuid primary key default gen_random_uuid(),
  detalle text not null,
  grupo text,
  orden int,
  valor_movil numeric(14,2),
  saldo_cancelacion numeric(14,2),
  fecha_inicio date,
  cuotas_totales int not null,
  cuotas_pagas int not null default 0,
  cuotas_adelantadas int,
  importe_cuota numeric(14,2) not null,
  moneda text not null default 'ARS',
  fecha_vencimiento date,
  activa boolean not null default true,
  link_pago text,
  modelo_referencia text,
  created_at timestamptz not null default now()
);

-- 10. cuotas_planes_ahorro (savings plan installments)
create table nodo_finanzas_personales.cuotas_planes_ahorro (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references nodo_finanzas_personales.planes_ahorro(id) on delete cascade,
  numero_cuota int not null,
  fecha_vencimiento date not null,
  importe numeric(14,2) not null,
  pagada boolean not null default false,
  fecha_pago date,
  gasto_diario_id uuid references nodo_finanzas_personales.gastos_diarios(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 11. cuentas_bancarias (bank account references)
create table nodo_finanzas_personales.cuentas_bancarias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  banco text not null,
  titular text,
  tipo text,
  cuenta_saldo_id uuid references nodo_finanzas_personales.cuentas(id),
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

-- 12. movimientos_cuenta (account ledger entries)
create table nodo_finanzas_personales.movimientos_cuenta (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references nodo_finanzas_personales.cuentas(id) on delete cascade,
  fecha date not null default current_date,
  descripcion text not null,
  monto numeric(14,2) not null,
  tipo text not null check (tipo in ('entrada', 'salida')),
  origen text,
  referencia_id uuid,
  detalle text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 13. sueldos (salary references)
create table nodo_finanzas_personales.sueldos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  monto numeric(14,2) not null,
  moneda text not null default 'ARS',
  activo boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 14. categorias (expense type configuration)
create table nodo_finanzas_personales.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

-- 15. cotizaciones_dolar (USD exchange rate cache)
create table nodo_finanzas_personales.cotizaciones_dolar (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  compra numeric(14,4) not null,
  venta numeric(14,4) not null,
  fecha_actualizacion timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 16. configuracion_usuario (key-value app settings)
create table nodo_finanzas_personales.configuracion_usuario (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  valor jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- RLS — authenticated-only access (single shared dataset)
-- ============================================================

-- Enable RLS on all tables
alter table nodo_finanzas_personales.cuentas enable row level security;
alter table nodo_finanzas_personales.rubros enable row level security;
alter table nodo_finanzas_personales.gastos_fijos enable row level security;
alter table nodo_finanzas_personales.tarjetas enable row level security;
alter table nodo_finanzas_personales.tarjetas_consumos enable row level security;
alter table nodo_finanzas_personales.gastos_diarios enable row level security;
alter table nodo_finanzas_personales.prestamos enable row level security;
alter table nodo_finanzas_personales.cuotas_programadas enable row level security;
alter table nodo_finanzas_personales.planes_ahorro enable row level security;
alter table nodo_finanzas_personales.cuotas_planes_ahorro enable row level security;
alter table nodo_finanzas_personales.cuentas_bancarias enable row level security;
alter table nodo_finanzas_personales.movimientos_cuenta enable row level security;
alter table nodo_finanzas_personales.sueldos enable row level security;
alter table nodo_finanzas_personales.categorias enable row level security;
alter table nodo_finanzas_personales.cotizaciones_dolar enable row level security;
alter table nodo_finanzas_personales.configuracion_usuario enable row level security;

-- Policies: any authenticated user can access all rows (single shared dataset)
create policy "authenticated_all" on nodo_finanzas_personales.cuentas for all to authenticated using (true) with check (true);
create policy "authenticated_all" on nodo_finanzas_personales.rubros for all to authenticated using (true) with check (true);
create policy "authenticated_all" on nodo_finanzas_personales.gastos_fijos for all to authenticated using (true) with check (true);
create policy "authenticated_all" on nodo_finanzas_personales.tarjetas for all to authenticated using (true) with check (true);
create policy "authenticated_all" on nodo_finanzas_personales.tarjetas_consumos for all to authenticated using (true) with check (true);
create policy "authenticated_all" on nodo_finanzas_personales.gastos_diarios for all to authenticated using (true) with check (true);
create policy "authenticated_all" on nodo_finanzas_personales.prestamos for all to authenticated using (true) with check (true);
create policy "authenticated_all" on nodo_finanzas_personales.cuotas_programadas for all to authenticated using (true) with check (true);
create policy "authenticated_all" on nodo_finanzas_personales.planes_ahorro for all to authenticated using (true) with check (true);
create policy "authenticated_all" on nodo_finanzas_personales.cuotas_planes_ahorro for all to authenticated using (true) with check (true);
create policy "authenticated_all" on nodo_finanzas_personales.cuentas_bancarias for all to authenticated using (true) with check (true);
create policy "authenticated_all" on nodo_finanzas_personales.movimientos_cuenta for all to authenticated using (true) with check (true);
create policy "authenticated_all" on nodo_finanzas_personales.sueldos for all to authenticated using (true) with check (true);
create policy "authenticated_all" on nodo_finanzas_personales.categorias for all to authenticated using (true) with check (true);
create policy "authenticated_all" on nodo_finanzas_personales.cotizaciones_dolar for all to authenticated using (true) with check (true);
create policy "authenticated_all" on nodo_finanzas_personales.configuracion_usuario for all to authenticated using (true) with check (true);

-- Grants
revoke all on all tables in schema nodo_finanzas_personales from anon;
grant select, insert, update, delete on all tables in schema nodo_finanzas_personales to authenticated;
grant select, insert, update, delete on all tables in schema nodo_finanzas_personales to service_role;

-- Expose schema via PostgREST (required for supabase-js .schema() calls)
alter role authenticator set pgrst.db_schemas = 'public, nodo_inmo, nodo_core, nodo_finanzas_personales';
notify pgrst, 'reload config';
