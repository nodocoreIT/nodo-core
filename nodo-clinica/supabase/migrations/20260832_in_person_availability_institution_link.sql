-- Migration: link in-person availability to an institution
-- "Turnos Presenciales" used to collect address/phone as free text.
-- Now it references one of the doctor's already-registered institutions
-- (nodo_clinica.institutions) instead of asking for the address again.
-- location_info stays as-is (still used by the booking flow) — the address
-- shown there is now derived from the linked institution at save time.

ALTER TABLE nodo_clinica.in_person_availability
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES nodo_clinica.institutions(id) ON DELETE SET NULL;
