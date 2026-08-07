-- Jira-style task comments + image evidence for the panel kanban.

create table if not exists nodo_core.task_comments (
  id          uuid        primary key default gen_random_uuid(),
  task_id     uuid        not null references nodo_core.tasks(id) on delete cascade,
  author_id   uuid        references nodo_core.profiles(id) on delete set null,
  body        text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists task_comments_task_id_created_at_idx
  on nodo_core.task_comments (task_id, created_at asc);

create table if not exists nodo_core.task_comment_attachments (
  id           uuid        primary key default gen_random_uuid(),
  comment_id   uuid        not null references nodo_core.task_comments(id) on delete cascade,
  storage_path text        not null,
  file_name    text        not null,
  mime_type    text        not null,
  size_bytes   integer,
  created_at   timestamptz not null default now()
);

create index if not exists task_comment_attachments_comment_id_idx
  on nodo_core.task_comment_attachments (comment_id);

comment on table nodo_core.task_comments is
  'Panel activity comments (Jira-style) for nodo_core.tasks.';
comment on table nodo_core.task_comment_attachments is
  'Image evidence attached to task comments; files live in storage bucket panel-task-evidence.';

alter table nodo_core.task_comments enable row level security;
alter table nodo_core.task_comment_attachments enable row level security;

grant select, insert, update, delete on table nodo_core.task_comments to authenticated;
grant select, insert, update, delete on table nodo_core.task_comment_attachments to authenticated;

drop policy if exists task_comments_team_select on nodo_core.task_comments;
drop policy if exists task_comments_team_insert on nodo_core.task_comments;
drop policy if exists task_comments_team_update on nodo_core.task_comments;
drop policy if exists task_comments_team_delete on nodo_core.task_comments;

create policy task_comments_team_select on nodo_core.task_comments
  for select to authenticated
  using ((select nodo_core.is_team_member()));

create policy task_comments_team_insert on nodo_core.task_comments
  for insert to authenticated
  with check (
    (select nodo_core.is_team_member())
    and author_id = (select auth.uid())
  );

create policy task_comments_team_update on nodo_core.task_comments
  for update to authenticated
  using (
    (select nodo_core.is_team_member())
    and author_id = (select auth.uid())
  )
  with check (
    (select nodo_core.is_team_member())
    and author_id = (select auth.uid())
  );

create policy task_comments_team_delete on nodo_core.task_comments
  for delete to authenticated
  using ((select nodo_core.is_team_member()));

drop policy if exists task_comment_attachments_team_select on nodo_core.task_comment_attachments;
drop policy if exists task_comment_attachments_team_insert on nodo_core.task_comment_attachments;
drop policy if exists task_comment_attachments_team_delete on nodo_core.task_comment_attachments;

create policy task_comment_attachments_team_select on nodo_core.task_comment_attachments
  for select to authenticated
  using ((select nodo_core.is_team_member()));

create policy task_comment_attachments_team_insert on nodo_core.task_comment_attachments
  for insert to authenticated
  with check ((select nodo_core.is_team_member()));

create policy task_comment_attachments_team_delete on nodo_core.task_comment_attachments
  for delete to authenticated
  using ((select nodo_core.is_team_member()));

-- Private evidence bucket (images only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'panel-task-evidence',
  'panel-task-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists panel_task_evidence_select on storage.objects;
drop policy if exists panel_task_evidence_insert on storage.objects;
drop policy if exists panel_task_evidence_update on storage.objects;
drop policy if exists panel_task_evidence_delete on storage.objects;

create policy panel_task_evidence_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'panel-task-evidence'
    and (select nodo_core.is_team_member())
  );

create policy panel_task_evidence_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'panel-task-evidence'
    and (select nodo_core.is_team_member())
  );

create policy panel_task_evidence_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'panel-task-evidence'
    and (select nodo_core.is_team_member())
  )
  with check (
    bucket_id = 'panel-task-evidence'
    and (select nodo_core.is_team_member())
  );

create policy panel_task_evidence_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'panel-task-evidence'
    and (select nodo_core.is_team_member())
  );
