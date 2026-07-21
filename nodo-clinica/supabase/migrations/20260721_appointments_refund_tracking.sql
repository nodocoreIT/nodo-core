-- Adds refund tracking to appointments so a doctor-initiated cancellation of a
-- paid appointment can record how (and whether) the payment was returned to
-- the patient: a real Mercado Pago refund, or a manual transfer refund
-- acknowledged by the doctor.

ALTER TABLE nodo_clinica.appointments
  DROP CONSTRAINT IF EXISTS appointments_payment_status_check;

ALTER TABLE nodo_clinica.appointments
  ADD CONSTRAINT appointments_payment_status_check
  CHECK (payment_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'waived'::text, 'refunded'::text, 'refund_failed'::text]));

ALTER TABLE nodo_clinica.appointments
  ADD COLUMN IF NOT EXISTS refund_method text CHECK (refund_method = ANY (ARRAY['mercadopago'::text, 'transfer_manual'::text])),
  ADD COLUMN IF NOT EXISTS refund_amount numeric,
  ADD COLUMN IF NOT EXISTS refund_id text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_notes text,
  ADD COLUMN IF NOT EXISTS cancelled_by text CHECK (cancelled_by = ANY (ARRAY['patient'::text, 'doctor'::text])),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
