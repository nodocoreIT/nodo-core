-- Event-based notifications for task status/assignee changes (Jira-style).
--
-- Unlike nodo_core.panel_notifications and the computed-on-read panel
-- notifications (see lib/panel/build-panel-notifications.ts), this is a real
-- per-recipient inbox: every task mutation is a direct client → Supabase
-- write (no API route in between — see KanbanBoard.tsx handleDragEnd /
-- handleSaveTask), so the only reliable place to capture "what changed" is a
-- trigger on nodo_core.tasks itself.

create table if not exists nodo_core.task_notifications (
  id            uuid        primary key default gen_random_uuid(),
  task_id       uuid        not null references nodo_core.tasks(id) on delete cascade,
  recipient_id  uuid        not null references nodo_core.profiles(id) on delete cascade,
  actor_id      uuid        references nodo_core.profiles(id) on delete set null,
  type          text        not null check (type in ('status_changed', 'reassigned')),
  old_value     text,
  new_value     text,
  created_at    timestamptz not null default now(),
  email_sent_at timestamptz
);

create index if not exists task_notifications_recipient_created_idx
  on nodo_core.task_notifications (recipient_id, created_at desc);

create index if not exists task_notifications_email_pending_idx
  on nodo_core.task_notifications (email_sent_at)
  where email_sent_at is null;

comment on table nodo_core.task_notifications is
  'Per-recipient event inbox for task status/assignee changes. Rows are only ever inserted by the tasks_notify_participants trigger (security definer) — authenticated has no insert/update grant, only select of their own rows. email_sent_at is stamped by the send-task-notification-emails cron using the admin client.';

alter table nodo_core.task_notifications enable row level security;

grant select on table nodo_core.task_notifications to authenticated;

drop policy if exists task_notifications_recipient_select on nodo_core.task_notifications;

create policy task_notifications_recipient_select on nodo_core.task_notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

-- security definer + owner-bypasses-RLS (no FORCE ROW LEVEL SECURITY set
-- above) is what lets this insert rows for recipients other than the actor.
create or replace function nodo_core.notify_task_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  recipient uuid;
  participants uuid[];
begin
  if new.status is distinct from old.status then
    select array_agg(distinct p) into participants
    from unnest(
      array_remove(array[new.created_by, new.assignee], null)
      || coalesce(
           (select array_agg(distinct author_id)
            from nodo_core.task_comments
            where task_id = new.id and author_id is not null),
           array[]::uuid[]
         )
    ) as p
    where p is distinct from actor;

    if participants is not null then
      foreach recipient in array participants loop
        insert into nodo_core.task_notifications (task_id, recipient_id, actor_id, type, old_value, new_value)
        values (new.id, recipient, actor, 'status_changed', old.status, new.status);
      end loop;
    end if;
  end if;

  if new.assignee is distinct from old.assignee then
    select array_agg(distinct p) into participants
    from unnest(array_remove(array[old.assignee, new.assignee, new.created_by], null)) as p
    where p is distinct from actor;

    if participants is not null then
      foreach recipient in array participants loop
        insert into nodo_core.task_notifications (task_id, recipient_id, actor_id, type, old_value, new_value)
        values (new.id, recipient, actor, 'reassigned', old.assignee::text, new.assignee::text);
      end loop;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function nodo_core.notify_task_participants() from public, anon, authenticated;

drop trigger if exists tasks_notify_participants on nodo_core.tasks;

create trigger tasks_notify_participants
  after update on nodo_core.tasks
  for each row
  execute function nodo_core.notify_task_participants();
