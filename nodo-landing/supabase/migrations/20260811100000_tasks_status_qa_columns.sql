-- Two new Kanban columns between "review" and "done": deployed_qa
-- ("Deployado en QA") and qa_testing ("En QA Testing"). See
-- components/panel/KanbanBoard.tsx COLUMNS / lib/panel/task-status.ts.

alter table nodo_core.tasks
  drop constraint if exists tasks_status_check;

alter table nodo_core.tasks
  add constraint tasks_status_check
  check (status = any (array['backlog', 'doing', 'review', 'deployed_qa', 'qa_testing', 'done']));
