-- Social publishing: external post IDs + per-vehicle social copy
-- Nota: en producción las tablas viven en public (no nodo_autos).
alter table public.publications
  add column if not exists external_id text;

alter table public.vehicles
  add column if not exists social_title text,
  add column if not exists social_description text;
