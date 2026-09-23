-- Varios lugares de atención: provincia entera o provincia + localidad.

alter table nodo_clinica.professionals
  add column if not exists locations jsonb not null default '[]'::jsonb;

comment on column nodo_clinica.professionals.locations is
  'Lugares de atención [{ province, city? }]. city vacío = toda la provincia.';
