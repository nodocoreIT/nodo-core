-- The literal value "trial" was used both as subscription_status and
-- subscription_plan for the free plan. Renaming to "demo" for clarity, and
-- to match the id used by the onboarding form and nodo_core.planes'
-- "medico_demo" catalog code (see src/lib/clinic/subscription-plans.ts).
--
-- Doctors who chose a paid plan (subscription_plan = 'profesional') but never
-- completed MercadoPago checkout were also stuck at subscription_status =
-- 'trial' (the exact bug this change fixes going forward) — those rows can
-- be distinguished from real free-plan signups via subscription_plan, so
-- they get backfilled to the new "pending_payment" status instead of
-- "demo". Everyone else moves from 'trial' to 'demo'. Doctors who already
-- paid have subscription_status = 'active' and are unaffected.
--
-- The existing check constraint only allowed ('trial','active','expired')
-- and was not tracked by any migration in this repo (schema drift) — it's
-- dropped before the data backfill (it would reject 'demo'/'pending_payment')
-- and recreated after with the new value set.

ALTER TABLE nodo_clinica.professionals
  DROP CONSTRAINT IF EXISTS professionals_subscription_status_check;

UPDATE nodo_clinica.professionals
SET subscription_status = 'pending_payment'
WHERE subscription_status = 'trial' AND subscription_plan = 'profesional';

UPDATE nodo_clinica.professionals
SET subscription_status = 'demo'
WHERE subscription_status = 'trial';

UPDATE nodo_clinica.professionals
SET subscription_plan = 'demo'
WHERE subscription_plan = 'trial';

ALTER TABLE nodo_clinica.professionals
  ADD CONSTRAINT professionals_subscription_status_check
  CHECK (subscription_status = ANY (ARRAY['demo'::text, 'pending_payment'::text, 'active'::text, 'expired'::text]));
