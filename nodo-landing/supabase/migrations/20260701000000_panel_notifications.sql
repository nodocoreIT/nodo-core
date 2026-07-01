-- Panel notifications table — stores cross-node events (e.g. user feedback)
-- so the nodo-core dashboard can surface them without needing access to each
-- node's own Supabase project.

create table if not exists nodo_core.panel_notifications (
  id          uuid        primary key default gen_random_uuid(),
  kind        text        not null,
  category    text,
  content     text,
  source_node text        not null default 'unknown',
  created_at  timestamptz not null default now()
);

-- Only keep 90 days of notifications to avoid unbounded growth.
comment on table nodo_core.panel_notifications is
  'Cross-node event notifications for the nodo-core admin dashboard. Rows older than 90 days can be pruned.';

-- Service-role inserts only (called from API routes, never from the browser).
alter table nodo_core.panel_notifications enable row level security;

create policy "service role full access"
  on nodo_core.panel_notifications
  using (true)
  with check (true);
