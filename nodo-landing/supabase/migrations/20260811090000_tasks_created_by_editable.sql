-- created_by ("Reporter") is now editable from the task modal, same as
-- assignee — supersedes the "never edited afterward" comment from
-- 20260808200000_tasks_created_by.sql.

comment on column nodo_core.tasks.created_by is
  'Reporter — panel team member credited as having filed this task. Editable from the task modal (AssigneePicker), same as assignee.';
