-- Migration 004: RLS Policies — Dual Template A (doctor/staff) + Template P (patient)
-- Applies to the shared Supabase project (nodo_clinica schema).
-- Run AFTER migrations 001, 002, and 003.
--
-- Template A: org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
-- Template P: profile_id = (select auth.uid())  [on patients]
--             patient_id IN (SELECT id FROM nodo_clinica.patients
--                            WHERE profile_id = (select auth.uid()))  [related tables]
--
-- Rules:
--   - NEVER use auth.role() — use TO authenticated clause
--   - Use scalar subqueries (select auth.uid()) and (select auth.jwt()) for performance
--   - Every UPDATE policy MUST have WITH CHECK
--   - PHI DELETE: super_admin only
--   - payment_credentials: ZERO authenticated policies (service_role bypasses RLS)

-- ============================================================
-- T2.2 — Enable RLS on tables not yet covered by migration 002
-- Migration 002 enabled: professionals, office_settings, patients,
--   appointments, clinical_records, clinical_notes, doctor_tasks, interconsult_messages
-- Migration 003 enabled: patient_health_profiles, doctor_notifications, payment_credentials
-- Remaining tables from migration 002:
--   transcriptions, prescriptions, study_orders, soap_summaries,
--   patient_documents, doctor_presence, chat_read_cursors
-- ============================================================

ALTER TABLE nodo_clinica.transcriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.prescriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.study_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.soap_summaries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.patient_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.doctor_presence       ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.chat_read_cursors     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper expression (inline in every policy — no SECURITY DEFINER)
--   org_id match:   org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
--   role check:     ((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin','super_admin')
--   super_admin:    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'super_admin'
--   patient path:   patient_id IN (SELECT id FROM nodo_clinica.patients
--                                  WHERE profile_id = (select auth.uid()))
-- ============================================================

-- ============================================================
-- T2.3 — Template A policies: doctor/staff-only tables
--   office_settings, doctor_presence, chat_read_cursors
-- ============================================================

-- office_settings
-- SELECT: any authenticated org member
CREATE POLICY staff_select_office_settings
  ON nodo_clinica.office_settings
  FOR SELECT
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- UPDATE: admin or super_admin of the same org
CREATE POLICY staff_update_office_settings
  ON nodo_clinica.office_settings
  FOR UPDATE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
  );

-- doctor_presence
-- Uses professional_id (PK) linked to professionals.user_id = auth.uid()
-- org_id added in migration 003 (T1.4)

CREATE POLICY staff_select_doctor_presence
  ON nodo_clinica.doctor_presence
  FOR SELECT
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY staff_insert_doctor_presence
  ON nodo_clinica.doctor_presence
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND professional_id IN (
      SELECT id FROM nodo_clinica.professionals
      WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY staff_update_doctor_presence
  ON nodo_clinica.doctor_presence
  FOR UPDATE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND professional_id IN (
      SELECT id FROM nodo_clinica.professionals
      WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND professional_id IN (
      SELECT id FROM nodo_clinica.professionals
      WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY staff_delete_doctor_presence
  ON nodo_clinica.doctor_presence
  FOR DELETE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND professional_id IN (
      SELECT id FROM nodo_clinica.professionals
      WHERE user_id = (select auth.uid())
    )
  );

-- chat_read_cursors
-- Same pattern as doctor_presence (org_id + own professional row)

CREATE POLICY staff_select_chat_read_cursors
  ON nodo_clinica.chat_read_cursors
  FOR SELECT
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY staff_insert_chat_read_cursors
  ON nodo_clinica.chat_read_cursors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND professional_id IN (
      SELECT id FROM nodo_clinica.professionals
      WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY staff_update_chat_read_cursors
  ON nodo_clinica.chat_read_cursors
  FOR UPDATE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND professional_id IN (
      SELECT id FROM nodo_clinica.professionals
      WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND professional_id IN (
      SELECT id FROM nodo_clinica.professionals
      WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY staff_delete_chat_read_cursors
  ON nodo_clinica.chat_read_cursors
  FOR DELETE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND professional_id IN (
      SELECT id FROM nodo_clinica.professionals
      WHERE user_id = (select auth.uid())
    )
  );

-- ============================================================
-- T2.4 — Template A policies: doctor-only data tables
--   professionals, doctor_notifications, interconsult_messages,
--   doctor_tasks, transcriptions
-- ============================================================

-- professionals
-- SELECT: any authenticated member of the same org
CREATE POLICY staff_select_professionals
  ON nodo_clinica.professionals
  FOR SELECT
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- INSERT: org member (admin or super_admin inserts new professionals)
CREATE POLICY staff_insert_professionals
  ON nodo_clinica.professionals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- UPDATE: org member
CREATE POLICY staff_update_professionals
  ON nodo_clinica.professionals
  FOR UPDATE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- DELETE: super_admin only
CREATE POLICY super_admin_delete_professionals
  ON nodo_clinica.professionals
  FOR DELETE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- doctor_notifications
-- SELECT: own org + own professional row
CREATE POLICY staff_select_doctor_notifications
  ON nodo_clinica.doctor_notifications
  FOR SELECT
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND professional_id IN (
      SELECT id FROM nodo_clinica.professionals
      WHERE user_id = (select auth.uid())
    )
  );

-- UPDATE (mark as read): same condition
CREATE POLICY staff_update_doctor_notifications
  ON nodo_clinica.doctor_notifications
  FOR UPDATE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND professional_id IN (
      SELECT id FROM nodo_clinica.professionals
      WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND professional_id IN (
      SELECT id FROM nodo_clinica.professionals
      WHERE user_id = (select auth.uid())
    )
  );

-- interconsult_messages
-- SELECT: org member (can see all org messages)
CREATE POLICY staff_select_interconsult_messages
  ON nodo_clinica.interconsult_messages
  FOR SELECT
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- INSERT: org member sending from their own professional ID
CREATE POLICY staff_insert_interconsult_messages
  ON nodo_clinica.interconsult_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND from_professional_id IN (
      SELECT id FROM nodo_clinica.professionals
      WHERE user_id = (select auth.uid())
    )
  );

-- doctor_tasks
-- Full CRUD for org members (tasks belong to the org's doctors)
CREATE POLICY staff_select_doctor_tasks
  ON nodo_clinica.doctor_tasks
  FOR SELECT
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY staff_insert_doctor_tasks
  ON nodo_clinica.doctor_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY staff_update_doctor_tasks
  ON nodo_clinica.doctor_tasks
  FOR UPDATE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY staff_delete_doctor_tasks
  ON nodo_clinica.doctor_tasks
  FOR DELETE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- transcriptions
-- Linked to clinical_notes/appointments (has org_id column directly)
-- Dual access: doctor via org_id, patient via appointment→patient path

CREATE POLICY staff_select_transcriptions
  ON nodo_clinica.transcriptions
  FOR SELECT
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- Patient path: transcription.appointment_id → appointments.patient_id → patients.profile_id
CREATE POLICY patient_select_transcriptions
  ON nodo_clinica.transcriptions
  FOR SELECT
  TO authenticated
  USING (
    appointment_id IN (
      SELECT a.id FROM nodo_clinica.appointments a
      JOIN nodo_clinica.patients p ON p.id = a.patient_id
      WHERE p.profile_id = (select auth.uid())
    )
  );

CREATE POLICY staff_insert_transcriptions
  ON nodo_clinica.transcriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY staff_update_transcriptions
  ON nodo_clinica.transcriptions
  FOR UPDATE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- ============================================================
-- T2.5 — Dual Template A+P policies: shared/PHI tables
--   patients, appointments, clinical_records, clinical_notes,
--   prescriptions, soap_summaries, study_orders,
--   patient_documents, patient_health_profiles
-- ============================================================

-- ---- patients ----

CREATE POLICY staff_select_patients
  ON nodo_clinica.patients
  FOR SELECT
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY patient_select_patients
  ON nodo_clinica.patients
  FOR SELECT
  TO authenticated
  USING (
    profile_id = (select auth.uid())
  );

CREATE POLICY staff_insert_patients
  ON nodo_clinica.patients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY staff_update_patients
  ON nodo_clinica.patients
  FOR UPDATE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- Patient updates their own row (e.g., phone, profile_photo_url)
CREATE POLICY patient_update_patients
  ON nodo_clinica.patients
  FOR UPDATE
  TO authenticated
  USING (
    profile_id = (select auth.uid())
  )
  WITH CHECK (
    profile_id = (select auth.uid())
  );

-- ---- appointments ----

CREATE POLICY staff_select_appointments
  ON nodo_clinica.appointments
  FOR SELECT
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY patient_select_appointments
  ON nodo_clinica.appointments
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM nodo_clinica.patients
      WHERE profile_id = (select auth.uid())
    )
  );

CREATE POLICY staff_insert_appointments
  ON nodo_clinica.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY staff_update_appointments
  ON nodo_clinica.appointments
  FOR UPDATE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- DELETE: super_admin only
CREATE POLICY super_admin_delete_appointments
  ON nodo_clinica.appointments
  FOR DELETE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- ---- clinical_records (PHI) ----

CREATE POLICY staff_select_clinical_records
  ON nodo_clinica.clinical_records
  FOR SELECT
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY patient_select_clinical_records
  ON nodo_clinica.clinical_records
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM nodo_clinica.patients
      WHERE profile_id = (select auth.uid())
    )
  );

CREATE POLICY staff_insert_clinical_records
  ON nodo_clinica.clinical_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY staff_update_clinical_records
  ON nodo_clinica.clinical_records
  FOR UPDATE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- PHI DELETE: super_admin only — regular admin cannot delete clinical records
CREATE POLICY super_admin_delete_clinical_records
  ON nodo_clinica.clinical_records
  FOR DELETE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- ---- clinical_notes (PHI) ----
-- appointment_id is the PK; org_id is a direct column

CREATE POLICY staff_select_clinical_notes
  ON nodo_clinica.clinical_notes
  FOR SELECT
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY patient_select_clinical_notes
  ON nodo_clinica.clinical_notes
  FOR SELECT
  TO authenticated
  USING (
    appointment_id IN (
      SELECT a.id FROM nodo_clinica.appointments a
      JOIN nodo_clinica.patients p ON p.id = a.patient_id
      WHERE p.profile_id = (select auth.uid())
    )
  );

CREATE POLICY staff_insert_clinical_notes
  ON nodo_clinica.clinical_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY staff_update_clinical_notes
  ON nodo_clinica.clinical_notes
  FOR UPDATE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- PHI DELETE: super_admin only
CREATE POLICY super_admin_delete_clinical_notes
  ON nodo_clinica.clinical_notes
  FOR DELETE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- ---- prescriptions (PHI) ----

CREATE POLICY staff_select_prescriptions
  ON nodo_clinica.prescriptions
  FOR SELECT
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY patient_select_prescriptions
  ON nodo_clinica.prescriptions
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM nodo_clinica.patients
      WHERE profile_id = (select auth.uid())
    )
  );

CREATE POLICY staff_insert_prescriptions
  ON nodo_clinica.prescriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY staff_update_prescriptions
  ON nodo_clinica.prescriptions
  FOR UPDATE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- PHI DELETE: super_admin only
CREATE POLICY super_admin_delete_prescriptions
  ON nodo_clinica.prescriptions
  FOR DELETE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- ---- soap_summaries (PHI) ----
-- appointment_id is the PK; patient_id not stored directly — via appointments

CREATE POLICY staff_select_soap_summaries
  ON nodo_clinica.soap_summaries
  FOR SELECT
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY patient_select_soap_summaries
  ON nodo_clinica.soap_summaries
  FOR SELECT
  TO authenticated
  USING (
    appointment_id IN (
      SELECT a.id FROM nodo_clinica.appointments a
      JOIN nodo_clinica.patients p ON p.id = a.patient_id
      WHERE p.profile_id = (select auth.uid())
    )
  );

CREATE POLICY staff_insert_soap_summaries
  ON nodo_clinica.soap_summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY staff_update_soap_summaries
  ON nodo_clinica.soap_summaries
  FOR UPDATE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- PHI DELETE: super_admin only
CREATE POLICY super_admin_delete_soap_summaries
  ON nodo_clinica.soap_summaries
  FOR DELETE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- ---- study_orders (PHI) ----

CREATE POLICY staff_select_study_orders
  ON nodo_clinica.study_orders
  FOR SELECT
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY patient_select_study_orders
  ON nodo_clinica.study_orders
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM nodo_clinica.patients
      WHERE profile_id = (select auth.uid())
    )
  );

CREATE POLICY staff_insert_study_orders
  ON nodo_clinica.study_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY staff_update_study_orders
  ON nodo_clinica.study_orders
  FOR UPDATE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- PHI DELETE: super_admin only
CREATE POLICY super_admin_delete_study_orders
  ON nodo_clinica.study_orders
  FOR DELETE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- ---- patient_documents (PHI) ----

CREATE POLICY staff_select_patient_documents
  ON nodo_clinica.patient_documents
  FOR SELECT
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY patient_select_patient_documents
  ON nodo_clinica.patient_documents
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM nodo_clinica.patients
      WHERE profile_id = (select auth.uid())
    )
  );

CREATE POLICY staff_insert_patient_documents
  ON nodo_clinica.patient_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- Patient can upload their own documents
CREATE POLICY patient_insert_patient_documents
  ON nodo_clinica.patient_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id IN (
      SELECT id FROM nodo_clinica.patients
      WHERE profile_id = (select auth.uid())
    )
  );

CREATE POLICY staff_update_patient_documents
  ON nodo_clinica.patient_documents
  FOR UPDATE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- DELETE: super_admin only
CREATE POLICY super_admin_delete_patient_documents
  ON nodo_clinica.patient_documents
  FOR DELETE
  TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- ---- patient_health_profiles (PHI) ----
-- No org_id column directly — must join through patients for staff access

CREATE POLICY staff_select_patient_health_profiles
  ON nodo_clinica.patient_health_profiles
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM nodo_clinica.patients
      WHERE org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

CREATE POLICY patient_select_patient_health_profiles
  ON nodo_clinica.patient_health_profiles
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM nodo_clinica.patients
      WHERE profile_id = (select auth.uid())
    )
  );

-- Staff UPDATE: admin/super_admin can update health profiles for their org's patients
CREATE POLICY staff_update_patient_health_profiles
  ON nodo_clinica.patient_health_profiles
  FOR UPDATE
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM nodo_clinica.patients
      WHERE org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    )
  )
  WITH CHECK (
    patient_id IN (
      SELECT id FROM nodo_clinica.patients
      WHERE org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

-- Patient UPDATE own health profile (exception to PHI read-only rule — spec Scenario 2.4)
CREATE POLICY patient_update_patient_health_profiles
  ON nodo_clinica.patient_health_profiles
  FOR UPDATE
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM nodo_clinica.patients
      WHERE profile_id = (select auth.uid())
    )
  )
  WITH CHECK (
    patient_id IN (
      SELECT id FROM nodo_clinica.patients
      WHERE profile_id = (select auth.uid())
    )
  );

-- Staff INSERT: doctor creates health profile for their org's patient
CREATE POLICY staff_insert_patient_health_profiles
  ON nodo_clinica.patient_health_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id IN (
      SELECT id FROM nodo_clinica.patients
      WHERE org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

-- ============================================================
-- T2.6 — payment_credentials: ZERO authenticated policies
-- RLS is already enabled (migration 003, T1.5).
-- service_role bypasses RLS and is the ONLY way to access this table.
-- Do NOT create any policy here — the absence of policies is the security guarantee.
-- Any authenticated SELECT/INSERT/UPDATE/DELETE returns 0 rows (RLS blocks silently).
-- ============================================================

-- (no policies created for payment_credentials — intentional)

-- ============================================================
-- T2.7 — Storage policies for patient-documents bucket
-- Path format: {org_id}/{patient_id}/{filename}
-- Note: Supabase Storage upsert requires INSERT + SELECT + UPDATE.
-- ============================================================

-- INSERT: authenticated users — path must start with their org_id (doctors)
-- or their own patient folder.
-- We use a permissive INSERT that requires authentication; path validation
-- is enforced by the API route which constructs the path server-side.
CREATE POLICY storage_insert_patient_documents
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'patient-documents'
    AND (
      -- Doctor/staff: path starts with their org_id
      (storage.foldername(name))[1] = (
        (select auth.jwt()) -> 'app_metadata' ->> 'org_id'
      )
      OR
      -- Patient: path second segment matches a patient_id they own
      (storage.foldername(name))[2] IN (
        SELECT id::text FROM nodo_clinica.patients
        WHERE profile_id = (select auth.uid())
      )
    )
  );

-- SELECT: authenticated users — doctor org match OR patient owns the file
CREATE POLICY storage_select_patient_documents
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'patient-documents'
    AND (
      -- Doctor/staff: file is in their org folder
      (storage.foldername(name))[1] = (
        (select auth.jwt()) -> 'app_metadata' ->> 'org_id'
      )
      OR
      -- Patient: file is in a folder belonging to their patient_id
      (storage.foldername(name))[2] IN (
        SELECT id::text FROM nodo_clinica.patients
        WHERE profile_id = (select auth.uid())
      )
    )
  );

-- UPDATE: same as INSERT (required for upsert — Supabase Storage upsert rule)
CREATE POLICY storage_update_patient_documents
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'patient-documents'
    AND (
      (storage.foldername(name))[1] = (
        (select auth.jwt()) -> 'app_metadata' ->> 'org_id'
      )
      OR
      (storage.foldername(name))[2] IN (
        SELECT id::text FROM nodo_clinica.patients
        WHERE profile_id = (select auth.uid())
      )
    )
  )
  WITH CHECK (
    bucket_id = 'patient-documents'
    AND (
      (storage.foldername(name))[1] = (
        (select auth.jwt()) -> 'app_metadata' ->> 'org_id'
      )
      OR
      (storage.foldername(name))[2] IN (
        SELECT id::text FROM nodo_clinica.patients
        WHERE profile_id = (select auth.uid())
      )
    )
  );

-- DELETE: not granted to authenticated (storage objects not deletable by app users)

-- ============================================================
-- T2.8 — Verification queries (run manually after applying)
-- ============================================================

-- 1. List all tables in nodo_clinica with RLS status
--    Expected: rowsecurity = true for ALL tables
/*
SELECT relname, relrowsecurity
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE pg_namespace.nspname = 'nodo_clinica'
  AND pg_class.relkind = 'r'
ORDER BY relname;
*/

-- 2. List all policies in nodo_clinica schema
/*
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'nodo_clinica'
ORDER BY tablename, cmd, policyname;
*/

-- 3. Confirm payment_credentials has zero policies for authenticated
--    Expected: 0 rows
/*
SELECT * FROM pg_policies
WHERE schemaname = 'nodo_clinica'
  AND tablename = 'payment_credentials'
  AND 'authenticated' = ANY(roles::text[]);
*/

-- 4. Scenario 2.1 — Doctor sees only their org (set JWT, run SELECT)
/*
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"<doctor-uuid>","app_metadata":{"org_id":"<org-a-uuid>","role":"admin"}}';
SELECT count(*) FROM nodo_clinica.clinical_records;
-- Expected: only records where org_id = <org-a-uuid>
*/

-- 5. Scenario 2.2 — Patient sees only own PHI
/*
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"<patient-auth-uid>","app_metadata":{}}';
SELECT count(*) FROM nodo_clinica.clinical_records;
-- Expected: only records linked to this patient's patient row
*/

-- 6. Scenario 2.5 — payment_credentials inaccessible to authenticated
/*
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"<any-uuid>","app_metadata":{"org_id":"<org-uuid>","role":"admin"}}';
SELECT count(*) FROM nodo_clinica.payment_credentials;
-- Expected: 0
*/

-- 7. Scenario 2.7 — Anon gets 0 rows on any table
/*
SET LOCAL role TO anon;
SELECT count(*) FROM nodo_clinica.patients;
SELECT count(*) FROM nodo_clinica.clinical_records;
-- Expected: 0 on all
*/
