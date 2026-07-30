-- Nothing distinguished "onboarding completo, pendiente de aprobación del
-- admin" from "aprobado" — professionals showed up in the patient-facing
-- doctors list (and were bookable) the instant onboarding finished, before
-- the admin ever clicked "Habilitar" in /panel/solicitudes-pendientes.
-- email_confirm on auth.users doesn't work as that signal either — it's set
-- during email verification (step 2), long before admin approval.
alter table nodo_clinica.professionals
  add column if not exists enabled_at timestamptz;

comment on column nodo_clinica.professionals.enabled_at is
  'Set when an admin approves the clinic registration (POST /api/admin/clinic-registrations). NULL means still pending — must not appear in the patient-facing doctors list.';
