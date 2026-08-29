-- Migration: allow turnos presenciales to skip jitsi_room_id
-- appointments.jitsi_room_id was NOT NULL from the original virtual-only
-- schema. Presencial bookings never need a video room — the insert already
-- passes NULL for them (appointments/route.ts) but the column constraint
-- rejected it. In-person appointments carry institution_id instead.

ALTER TABLE nodo_clinica.appointments
  ALTER COLUMN jitsi_room_id DROP NOT NULL;
