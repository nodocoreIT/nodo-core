-- @mentions in task comments notify the mentioned team member — same
-- event-inbox model as tasks_notify_participants (see
-- 20260810120000_task_notifications.sql), just triggered by
-- nodo_core.task_comments instead of nodo_core.tasks.
--
-- Matching is a plain case-insensitive prefix match against
-- profiles.full_name ("@florencia" matches "Florencia Teves"). No unaccent —
-- if that becomes a real problem for accented names, add it then.

alter table nodo_core.task_notifications
  drop constraint if exists task_notifications_type_check;

alter table nodo_core.task_notifications
  add constraint task_notifications_type_check
  check (type = any (array['status_changed', 'reassigned', 'mentioned']));

create or replace function nodo_core.notify_comment_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := new.author_id;
  tokens text[];
  recipients uuid[];
  recipient uuid;
begin
  select array_agg(distinct lower(m[1]))
  into tokens
  from regexp_matches(new.body, '@([[:alnum:]_]+)', 'g') as m;

  if tokens is null then
    return new;
  end if;

  select array_agg(distinct p.id)
  into recipients
  from nodo_core.profiles p
  where p.id is distinct from actor
    and exists (
      select 1 from unnest(tokens) as t
      where p.full_name ilike t || '%'
    );

  if recipients is not null then
    foreach recipient in array recipients loop
      insert into nodo_core.task_notifications (task_id, recipient_id, actor_id, type, old_value, new_value)
      values (new.task_id, recipient, actor, 'mentioned', null, null);
    end loop;
  end if;

  return new;
end;
$$;

revoke execute on function nodo_core.notify_comment_mentions() from public, anon, authenticated;

drop trigger if exists task_comments_notify_mentions on nodo_core.task_comments;

create trigger task_comments_notify_mentions
  after insert on nodo_core.task_comments
  for each row
  execute function nodo_core.notify_comment_mentions();
