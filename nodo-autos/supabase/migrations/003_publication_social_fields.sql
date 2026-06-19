-- Social publishing: external post IDs + per-vehicle social copy
alter table nodo_autos.publications
  add column if not exists external_id text;

alter table nodo_autos.vehicles
  add column if not exists social_title text,
  add column if not exists social_description text;
