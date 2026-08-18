-- Migration: allow a "courtesy" subscription_status on professionals
-- Lets NodoCore admins grant a médico free/comped access to Nodo Clínica
-- (e.g. their demo trial expired and NodoCore decides to let them keep
-- using the app without paying) without touching MercadoPago at all.
-- See isSubscriptionActive() in src/lib/clinic/trial.ts, which treats
-- "courtesy" the same as "active" (always allowed, ignores trial_ends_at).

ALTER TABLE nodo_clinica.professionals DROP CONSTRAINT professionals_subscription_status_check;
ALTER TABLE nodo_clinica.professionals
  ADD CONSTRAINT professionals_subscription_status_check
  CHECK (subscription_status = ANY (ARRAY['demo','pending_payment','active','expired','courtesy']::text[]));
