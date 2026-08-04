-- Allow a client_unit_subscriptions row to be marked 'cancelled' (voluntary
-- cancel — distinct from 'past_due', which is a failed/missed charge).

alter table nodo_core.client_unit_subscriptions
  drop constraint if exists client_unit_subscriptions_status_check;

alter table nodo_core.client_unit_subscriptions
  add constraint client_unit_subscriptions_status_check
  check (status = any (array['active', 'past_due', 'paused', 'cancelled']));
