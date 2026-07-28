-- Free/Demo plan is time-limited (10 days from signup), Pro is unlimited
-- while the recurring MercadoPago subscription is active. There is no
-- feature difference between the two plans — only access time.
--
-- Until now, subscription_status could be 'trial' with no expiration date
-- anywhere, so nothing ever moved a doctor from 'trial' to 'expired'. This
-- column stores the trial deadline computed at signup
-- (see computeTrialEndsAt() in src/lib/clinic/trial.ts); access checks now
-- treat 'trial' as active only while trial_ends_at hasn't passed
-- (see isSubscriptionActive() in the same file).

ALTER TABLE nodo_clinica.professionals
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
