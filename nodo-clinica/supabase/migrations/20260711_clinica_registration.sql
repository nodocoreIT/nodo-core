-- Migration: clinica registration onboarding
-- Creates pending_clinic_registrations table, adds missing columns to patients,
-- creates Storage bucket and RLS policies.

-- ─── pending_clinic_registrations ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nodo_clinica.pending_clinic_registrations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  role        text NOT NULL CHECK (role IN ('medico', 'paciente')),
  token       uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate pending registrations for the same (email, role) pair
-- while neither has been verified yet.
CREATE UNIQUE INDEX IF NOT EXISTS pending_clinic_registrations_email_role_unverified
  ON nodo_clinica.pending_clinic_registrations (email, role)
  WHERE verified_at IS NULL;

-- Enable RLS; service role bypasses it. No user-facing policies needed.
ALTER TABLE nodo_clinica.pending_clinic_registrations ENABLE ROW LEVEL SECURITY;

-- ─── patients: add missing columns ─────────────────────────────────────────

ALTER TABLE nodo_clinica.patients
  ADD COLUMN IF NOT EXISTS address           text,
  ADD COLUMN IF NOT EXISTS obra_social       text,
  ADD COLUMN IF NOT EXISTS dni_front_path    text,
  ADD COLUMN IF NOT EXISTS dni_back_path     text,
  ADD COLUMN IF NOT EXISTS subscription_plan text;

-- ─── Storage bucket ─────────────────────────────────────────────────────────
-- Note: bucket creation via SQL requires the storage extension to be available.
-- If using Supabase dashboard, create the bucket manually as 'clinic-registration-docs'
-- with public: false. The INSERT below is idempotent via ON CONFLICT DO NOTHING.

INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-registration-docs', 'clinic-registration-docs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the storage bucket:
-- Authenticated users may only upload/read objects in their own uid folder.

DO $$
BEGIN
  -- Allow authenticated users to upload (INSERT) to their own folder
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'clinic_docs_authenticated_insert'
  ) THEN
    CREATE POLICY clinic_docs_authenticated_insert
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'clinic-registration-docs'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  -- Allow authenticated users to read their own files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'clinic_docs_authenticated_select'
  ) THEN
    CREATE POLICY clinic_docs_authenticated_select
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'clinic-registration-docs'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END;
$$;
