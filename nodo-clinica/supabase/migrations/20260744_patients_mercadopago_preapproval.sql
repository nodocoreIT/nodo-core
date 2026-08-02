-- Patient platform subscription checkout (Mercado Pago Preapproval), same pattern as professionals.

ALTER TABLE nodo_clinica.patients
  ADD COLUMN IF NOT EXISTS mercadopago_preapproval_id text;
