-- Localidad del médico (perfil). Se usa en Buscar médico junto a institutions.city.

alter table nodo_clinica.professionals
  add column if not exists city text;

comment on column nodo_clinica.professionals.city is
  'Localidad de atención del profesional, editable desde Configuración > Perfil.';
