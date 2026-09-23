-- Provincia del médico (junto a city) para mostrar "Localidad, Provincia".

alter table nodo_clinica.professionals
  add column if not exists province text;

comment on column nodo_clinica.professionals.province is
  'Provincia argentina del profesional, editable desde Configuración > Perfil.';
