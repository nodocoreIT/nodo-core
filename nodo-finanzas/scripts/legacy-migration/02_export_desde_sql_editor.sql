-- =============================================================================
-- PASO 2 (alternativa) — Supabase viejo, schema PUBLIC, sin pg_dump
-- Table Editor → Export CSV también sirve (una tabla a la vez).
-- =============================================================================

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.rubros t;

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.categorias t;

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.subcategorias t;

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.cuentas t;

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.sueldos t;

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.tarjetas t;

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.prestamos t;

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.planes_ahorro t;

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.cuentas_bancarias t;

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.gastos_fijos t;

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.gastos_diarios t;

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.tarjetas_consumos t;

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.movimientos_cuenta t;

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.cuotas_programadas t;

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.cuotas_planes_ahorro t;

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.configuracion_usuario t;

select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb))
from public.cotizaciones_dolar t;
