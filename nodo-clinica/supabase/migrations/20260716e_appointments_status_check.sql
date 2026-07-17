-- Fix appointments_status_check to match the app's actual status vocabulary.
-- The constraint was created with an older vocabulary (pending/in_waiting_room/
-- in_progress) that the app never used — the app has always inserted/queried
-- scheduled/waiting/in_consultation instead, so every appointment insert was
-- one query away from violating this check constraint.

ALTER TABLE nodo_clinica.appointments
  DROP CONSTRAINT appointments_status_check;

ALTER TABLE nodo_clinica.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status = ANY (ARRAY['scheduled'::text, 'waiting'::text, 'in_consultation'::text, 'completed'::text, 'cancelled'::text]));

ALTER TABLE nodo_clinica.appointments
  ALTER COLUMN status SET DEFAULT 'scheduled'::text;
