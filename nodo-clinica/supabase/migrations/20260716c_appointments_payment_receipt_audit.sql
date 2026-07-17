-- Add payment_receipt_audit column to appointments.
-- The patient booking flow stores the AI validation result (amount/recipient/date
-- match against the appointment) for manual doctor review, but this column was
-- referenced across the codebase without ever being added via migration.

ALTER TABLE nodo_clinica.appointments
  ADD COLUMN IF NOT EXISTS payment_receipt_audit jsonb;
