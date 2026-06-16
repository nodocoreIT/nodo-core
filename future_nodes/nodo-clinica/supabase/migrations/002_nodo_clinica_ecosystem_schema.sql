-- Nodo Clínica — schema ecosistema (multi-tenant)
-- Ejecutar en el Supabase compartido del monorepo, después de shared.* (nodo-inmo migrations)
-- Convención: org_id + RLS Template A (staff del org)

CREATE SCHEMA IF NOT EXISTS nodo_clinica;

-- Médicos / profesionales de salud
CREATE TABLE IF NOT EXISTS nodo_clinica.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  specialty TEXT,
  license_number TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'expired')),
  subscription_plan TEXT NOT NULL DEFAULT 'trial',
  profile_photo_url TEXT,
  bio TEXT,
  signature_text TEXT,
  signature_image_url TEXT,
  google_calendar_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, email)
);

-- Configuración de consultorio (agenda, cobros, tema)
CREATE TABLE IF NOT EXISTS nodo_clinica.office_settings (
  professional_id UUID PRIMARY KEY REFERENCES nodo_clinica.professionals(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  availability JSONB NOT NULL DEFAULT '{"slotDurationMinutes":30,"days":[]}'::jsonb,
  payment JSONB NOT NULL DEFAULT '{}'::jsonb,
  reminder_settings JSONB NOT NULL DEFAULT '{"enabled":false,"minutesBefore":1440}'::jsonb,
  theme_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pacientes
CREATE TABLE IF NOT EXISTS nodo_clinica.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  profile_photo_url TEXT,
  date_of_birth DATE,
  medical_record_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, email)
);

-- Turnos
CREATE TABLE IF NOT EXISTS nodo_clinica.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES nodo_clinica.professionals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES nodo_clinica.patients(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'waiting', 'in_consultation', 'completed', 'cancelled')),
  queue_position INTEGER NOT NULL DEFAULT 0,
  jitsi_room_id TEXT NOT NULL,
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_expires_at TIMESTAMPTZ NOT NULL,
  payment_status TEXT CHECK (payment_status IN ('pending', 'confirmed', 'waived')),
  payment_confirmed_at TIMESTAMPTZ,
  payment_provider TEXT,
  intake_reason TEXT,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historias clínicas / fichas
CREATE TABLE IF NOT EXISTS nodo_clinica.clinical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES nodo_clinica.patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES nodo_clinica.professionals(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES nodo_clinica.appointments(id) ON DELETE SET NULL,
  record_type TEXT NOT NULL DEFAULT 'consultation',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nodo_clinica.clinical_notes (
  appointment_id UUID PRIMARY KEY REFERENCES nodo_clinica.appointments(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES nodo_clinica.professionals(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nodo_clinica.transcriptions (
  appointment_id UUID PRIMARY KEY REFERENCES nodo_clinica.appointments(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nodo_clinica.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES nodo_clinica.appointments(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES nodo_clinica.professionals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES nodo_clinica.patients(id) ON DELETE CASCADE,
  medications JSONB NOT NULL DEFAULT '[]'::jsonb,
  pdf_url TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nodo_clinica.study_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES nodo_clinica.appointments(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES nodo_clinica.professionals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES nodo_clinica.patients(id) ON DELETE CASCADE,
  studies JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nodo_clinica.soap_summaries (
  appointment_id UUID PRIMARY KEY REFERENCES nodo_clinica.appointments(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  subjective TEXT NOT NULL DEFAULT '',
  objective TEXT NOT NULL DEFAULT '',
  analysis TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nodo_clinica.patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES nodo_clinica.patients(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES nodo_clinica.appointments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_doctor BOOLEAN NOT NULL DEFAULT FALSE
);

-- Tareas manuales del médico
CREATE TABLE IF NOT EXISTS nodo_clinica.doctor_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES nodo_clinica.professionals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat Pro / interconsultas
CREATE TABLE IF NOT EXISTS nodo_clinica.interconsult_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES shared.organizations(id) ON DELETE SET NULL,
  from_professional_id UUID NOT NULL,
  from_professional_name TEXT NOT NULL,
  to_professional_id UUID,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nodo_clinica.doctor_presence (
  professional_id UUID PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nodo_clinica.chat_read_cursors (
  professional_id UUID PRIMARY KEY,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_clinica_appointments_doctor
  ON nodo_clinica.appointments (org_id, doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_clinica_appointments_patient
  ON nodo_clinica.appointments (org_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_clinica_records_patient
  ON nodo_clinica.clinical_records (org_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_clinica_tasks_doctor_due
  ON nodo_clinica.doctor_tasks (org_id, doctor_id, due_date);

-- RLS (Template A — staff del org)
ALTER TABLE nodo_clinica.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.office_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.clinical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.doctor_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.interconsult_messages ENABLE ROW LEVEL SECURITY;

-- Política genérica staff (repetir patrón nodo-inmo en migración dedicada)
-- org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid

COMMENT ON SCHEMA nodo_clinica IS 'Dominio Nodo Salud — PHI clínico, multi-tenant vía shared.organizations';
