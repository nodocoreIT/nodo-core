-- =============================================================================
-- PASO 1 — Ejecutar en el SUPABASE VIEJO (SQL Editor)
-- Tus tablas están en schema PUBLIC (sin nodo_finanzas_personales).
-- =============================================================================

-- Tablas de finanzas en public
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'rubros', 'categorias', 'subcategorias', 'cuentas', 'sueldos', 'tarjetas',
    'prestamos', 'planes_ahorro', 'cuentas_bancarias', 'gastos_fijos',
    'gastos_diarios', 'tarjetas_consumos', 'movimientos_cuenta',
    'cuotas_programadas', 'cuotas_planes_ahorro',
    'configuracion_usuario', 'cotizaciones_dolar'
  )
order by 1;

-- Conteo de filas (public)
select 'rubros' as tabla, count(*) from public.rubros
union all select 'categorias', count(*) from public.categorias
union all select 'subcategorias', count(*) from public.subcategorias
union all select 'cuentas', count(*) from public.cuentas
union all select 'sueldos', count(*) from public.sueldos
union all select 'tarjetas', count(*) from public.tarjetas
union all select 'prestamos', count(*) from public.prestamos
union all select 'planes_ahorro', count(*) from public.planes_ahorro
union all select 'cuentas_bancarias', count(*) from public.cuentas_bancarias
union all select 'gastos_fijos', count(*) from public.gastos_fijos
union all select 'gastos_diarios', count(*) from public.gastos_diarios
union all select 'tarjetas_consumos', count(*) from public.tarjetas_consumos
union all select 'movimientos_cuenta', count(*) from public.movimientos_cuenta
union all select 'cuotas_programadas', count(*) from public.cuotas_programadas
union all select 'cuotas_planes_ahorro', count(*) from public.cuotas_planes_ahorro
union all select 'configuracion_usuario', count(*) from public.configuracion_usuario
union all select 'cotizaciones_dolar', count(*) from public.cotizaciones_dolar;

-- ¿Tiene user_id? (en legacy mono-usuario suele ser NO)
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and column_name = 'user_id'
  and table_name in ('cuentas', 'gastos_diarios', 'rubros');

-- Muestra de gastos recientes (confirmar que es TU data)
select id, descripcion, monto, fecha, forma_de_pago, created_at
from public.gastos_diarios
order by fecha desc
limit 10;

-- Estructura de subcategorias (tabla extra vs nodocore — se exporta igual)
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'subcategorias'
order by ordinal_position;
