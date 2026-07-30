-- Patients can book their own appointments — the only INSERT policy that
-- existed was staff_insert_appointments (org_id = jwt org_id), with nothing
-- allowing a patient to create their own appointment row. Mirrors
-- patient_select_appointments' ownership check (patient_id belongs to the
-- signed-in patient), scoped to insert only.
create policy "patient_insert_appointments" on nodo_clinica.appointments
for insert
to authenticated
with check (
  patient_id in (
    select patients.id
    from nodo_clinica.patients
    where patients.profile_id = (select auth.uid())
  )
);
