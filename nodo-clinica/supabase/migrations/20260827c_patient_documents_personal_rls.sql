-- RLS for "Mis estudios" personal (appointment-less) documents. A patient may
-- select/insert/delete their own rows where appointment_id IS NULL — the
-- existing appointment-scoped policies already qualify on appointment/doctor
-- and never match a null appointment_id, so they are untouched by this file
-- and keep working exactly as before (see sdd/mis-estudios/design, "Audit
-- findings"). Ownership check mirrors 20260735_patient_insert_appointments.sql
-- (patients.profile_id = auth.uid()), scoped to personal documents only.

create policy "pd_patient_personal_select" on nodo_clinica.patient_documents
for select
to authenticated
using (
  appointment_id is null
  and patient_id in (
    select patients.id
    from nodo_clinica.patients
    where patients.profile_id = (select auth.uid())
  )
);

create policy "pd_patient_personal_insert" on nodo_clinica.patient_documents
for insert
to authenticated
with check (
  appointment_id is null
  and patient_id in (
    select patients.id
    from nodo_clinica.patients
    where patients.profile_id = (select auth.uid())
  )
);

create policy "pd_patient_personal_delete" on nodo_clinica.patient_documents
for delete
to authenticated
using (
  appointment_id is null
  and patient_id in (
    select patients.id
    from nodo_clinica.patients
    where patients.profile_id = (select auth.uid())
  )
);
