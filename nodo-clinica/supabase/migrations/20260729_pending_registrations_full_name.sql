-- Store the name entered at registration so the verification email can greet
-- the person by name instead of a generic "Hola,".
ALTER TABLE nodo_clinica.pending_clinic_registrations
  ADD COLUMN IF NOT EXISTS full_name text;
