-- Permite pausar el acceso de un médico o un paciente por separado, sin
-- afectar al otro rol aunque compartan el mismo auth.users (una sola
-- cuenta, dos perfiles posibles). No se puede lograr esto desvinculando
-- user_id/profile_id: el login normal (linkClinicMembershipProfiles en
-- resolve-clinic-role.ts) revincula automáticamente por email en cada
-- inicio de sesión, así que cualquier bloqueo basado en desvincular queda
-- sin efecto apenas el usuario vuelve a loguearse. paused_at es un gate
-- explícito e independiente, chequeado en el login antes de conceder acceso.
ALTER TABLE nodo_clinica.professionals ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE nodo_clinica.patients ADD COLUMN IF NOT EXISTS paused_at timestamptz;
