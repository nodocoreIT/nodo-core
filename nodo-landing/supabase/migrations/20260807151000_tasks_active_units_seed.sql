-- Units selectable in the panel kanban (active set). Required by tasks.unit_code FK.
insert into nodo_core.units (code, name, sort)
values
  ('Clínica', 'Clínica', 90),
  ('Dashboard', 'Dashboard', 91),
  ('Landing', 'Landing', 92)
on conflict (code) do nothing;
