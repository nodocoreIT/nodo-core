-- Add due_time and all_day columns to nodo_inmo.tasks
--
-- all_day: when true, the task has no specific time (default behavior).
-- due_time: stores the specific time of the task when all_day is false.

alter table nodo_inmo.tasks
  add column if not exists all_day  boolean   not null default true,
  add column if not exists due_time time               default null;
