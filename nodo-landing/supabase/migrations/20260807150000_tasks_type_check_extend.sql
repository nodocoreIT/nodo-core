-- Allow kanban task types used by the panel UI (deuda técnica / known issue).
alter table nodo_core.tasks drop constraint if exists tasks_type_check;
alter table nodo_core.tasks
  add constraint tasks_type_check
  check (type = any (array[
    'task'::text,
    'bug'::text,
    'idea'::text,
    'debt'::text,
    'known_issue'::text
  ]));
