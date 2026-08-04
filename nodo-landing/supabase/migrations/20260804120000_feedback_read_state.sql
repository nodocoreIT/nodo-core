-- Feedback read-state tracking — persists which shared.feedback rows have
-- been marked as read by the NODO Core panel team. Presence of a row means
-- read; absence means unread (no backfill needed, correct default).
--
-- Does NOT touch shared.feedback: that schema is untracked in this repo's
-- migrations (owned by each node's own submit-feedback flow), so there is no
-- FK here — feedback_id is a plain uuid column keyed against it manually.

create table if not exists nodo_core.feedback_read_state (
  id          uuid        primary key default gen_random_uuid(),
  feedback_id uuid        not null unique,
  read_by     uuid,
  read_at     timestamptz not null default now()
);

comment on table nodo_core.feedback_read_state is
  'Read/unread state for shared.feedback rows, keyed by feedback_id. No FK to shared.feedback (schema untracked in migrations).';

-- Service-role inserts/reads only (called from API routes behind
-- requirePanelTeamMember(), never from the browser) — same pattern as
-- nodo_core.panel_notifications / dismissed_panel_notifications.
alter table nodo_core.feedback_read_state enable row level security;

create policy "service role full access"
  on nodo_core.feedback_read_state
  using (true)
  with check (true);
