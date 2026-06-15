-- Clínica Virtual - Schema inicial con RLS
-- Ejecutar en Supabase SQL Editor o via CLI

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Perfiles de usuario (médicos y pacientes)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('doctor', 'patient', 'admin')),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  specialty TEXT,
  license_number TEXT,
  signature_url TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Datos clínicos del paciente
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date_of_birth DATE,
  medical_record_number TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Turnos / citas
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'waiting', 'in_consultation', 'completed', 'cancelled')),
  queue_position INTEGER DEFAULT 0,
  jitsi_room_id TEXT NOT NULL,
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historial clínico
CREATE TABLE clinical_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  record_type TEXT NOT NULL DEFAULT 'consultation',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notas clínicas durante consulta
CREATE TABLE clinical_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(appointment_id)
);

-- Transcripciones
CREATE TABLE transcriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  segments JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(appointment_id)
);

-- Recetas digitales
CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medications JSONB NOT NULL DEFAULT '[]'::jsonb,
  pdf_url TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Órdenes de estudios
CREATE TABLE study_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  studies JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resúmenes SOAP generados por IA
CREATE TABLE soap_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  subjective TEXT NOT NULL DEFAULT '',
  objective TEXT NOT NULL DEFAULT '',
  analysis TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(appointment_id)
);

-- Documentos subidos por pacientes en sala de espera
CREATE TABLE patient_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  notified_doctor BOOLEAN DEFAULT FALSE
);

-- Índices
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id, status);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_token ON appointments(access_token);
CREATE INDEX idx_clinical_records_patient ON clinical_records(patient_id);
CREATE INDEX idx_patient_documents_appointment ON patient_documents(appointment_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER clinical_notes_updated_at
  BEFORE UPDATE ON clinical_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER transcriptions_updated_at
  BEFORE UPDATE ON transcriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE soap_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY;

-- Helper: obtener rol del usuario autenticado
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: verificar si el médico está asignado al paciente
CREATE OR REPLACE FUNCTION is_assigned_doctor(p_patient_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM appointments
    WHERE patient_id = p_patient_id
      AND doctor_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "Doctors can view assigned patient profiles"
  ON profiles FOR SELECT USING (
    auth_user_role() = 'doctor' AND EXISTS (
      SELECT 1 FROM patients p
      JOIN appointments a ON a.patient_id = p.id
      WHERE p.profile_id = profiles.id AND a.doctor_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (id = auth.uid());

-- PATIENTS
CREATE POLICY "Patients can view own record"
  ON patients FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Doctors can view assigned patients"
  ON patients FOR SELECT USING (
    auth_user_role() = 'doctor' AND is_assigned_doctor(id)
  );

-- APPOINTMENTS
CREATE POLICY "Doctors manage own appointments"
  ON appointments FOR ALL USING (doctor_id = auth.uid());

CREATE POLICY "Patients view own appointments"
  ON appointments FOR SELECT USING (
    EXISTS (SELECT 1 FROM patients WHERE id = appointments.patient_id AND profile_id = auth.uid())
  );

-- CLINICAL RECORDS
CREATE POLICY "Doctors access assigned patient records"
  ON clinical_records FOR ALL USING (
    auth_user_role() = 'doctor' AND doctor_id = auth.uid() AND is_assigned_doctor(patient_id)
  );

CREATE POLICY "Patients view own clinical records"
  ON clinical_records FOR SELECT USING (
    EXISTS (SELECT 1 FROM patients WHERE id = clinical_records.patient_id AND profile_id = auth.uid())
  );

-- CLINICAL NOTES
CREATE POLICY "Doctors manage notes for own appointments"
  ON clinical_notes FOR ALL USING (
    doctor_id = auth.uid() AND EXISTS (
      SELECT 1 FROM appointments WHERE id = clinical_notes.appointment_id AND doctor_id = auth.uid()
    )
  );

-- TRANSCRIPTIONS
CREATE POLICY "Doctors manage transcriptions for own appointments"
  ON transcriptions FOR ALL USING (
    EXISTS (
      SELECT 1 FROM appointments WHERE id = transcriptions.appointment_id AND doctor_id = auth.uid()
    )
  );

-- PRESCRIPTIONS
CREATE POLICY "Doctors manage prescriptions for assigned patients"
  ON prescriptions FOR ALL USING (
    doctor_id = auth.uid() AND is_assigned_doctor(patient_id)
  );

CREATE POLICY "Patients view own prescriptions"
  ON prescriptions FOR SELECT USING (
    EXISTS (SELECT 1 FROM patients WHERE id = prescriptions.patient_id AND profile_id = auth.uid())
  );

-- STUDY ORDERS
CREATE POLICY "Doctors manage study orders for assigned patients"
  ON study_orders FOR ALL USING (
    doctor_id = auth.uid() AND is_assigned_doctor(patient_id)
  );

CREATE POLICY "Patients view own study orders"
  ON study_orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM patients WHERE id = study_orders.patient_id AND profile_id = auth.uid())
  );

-- SOAP SUMMARIES
CREATE POLICY "Doctors manage SOAP for own appointments"
  ON soap_summaries FOR ALL USING (
    EXISTS (
      SELECT 1 FROM appointments WHERE id = soap_summaries.appointment_id AND doctor_id = auth.uid()
    )
  );

-- PATIENT DOCUMENTS
CREATE POLICY "Patients upload own documents"
  ON patient_documents FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM patients p
      JOIN appointments a ON a.patient_id = p.id
      WHERE p.id = patient_documents.patient_id
        AND p.profile_id = auth.uid()
        AND a.id = patient_documents.appointment_id
    )
  );

CREATE POLICY "Patients view own documents"
  ON patient_documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM patients WHERE id = patient_documents.patient_id AND profile_id = auth.uid())
  );

CREATE POLICY "Doctors view assigned patient documents"
  ON patient_documents FOR SELECT USING (
    auth_user_role() = 'doctor' AND is_assigned_doctor(patient_id)
  );

CREATE POLICY "Doctors update document notification status"
  ON patient_documents FOR UPDATE USING (
    auth_user_role() = 'doctor' AND is_assigned_doctor(patient_id)
  );

-- Storage bucket para documentos privados
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-documents',
  'patient-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Patients upload to own folder"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'patient-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Patients read own files"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'patient-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Doctors read assigned patient files"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'patient-documents'
    AND auth_user_role() = 'doctor'
  );

-- Realtime para cola y documentos
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE patient_documents;
