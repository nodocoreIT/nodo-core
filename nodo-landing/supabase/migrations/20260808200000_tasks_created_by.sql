-- Track who created each kanban task.

alter table nodo_core.tasks
  add column if not exists created_by uuid references nodo_core.profiles(id) on delete set null;

comment on column nodo_core.tasks.created_by is
  'Panel team member who created this task — set at insert time by the client, never edited afterward.';
