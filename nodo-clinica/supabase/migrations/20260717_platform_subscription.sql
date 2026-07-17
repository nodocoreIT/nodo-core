-- Adds the fields needed to bill doctors a monthly Nodo platform subscription
-- via MercadoPago's Preapproval (recurring) API, reusing the existing
-- professionals.subscription_status / subscription_plan columns that already
-- gate patient booking (see appointments POST: subscription_status === 'expired').

ALTER TABLE nodo_clinica.professionals
  ADD COLUMN IF NOT EXISTS mercadopago_preapproval_id text,
  ADD COLUMN IF NOT EXISTS subscription_next_payment_at timestamptz;
