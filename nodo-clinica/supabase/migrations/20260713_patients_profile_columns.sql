-- Migration: add profile columns to patients and fix onboarding_token column name
-- The patients table was missing full_name, email and org_id.
-- The pending_clinic_registrations token column may be named 'token' instead of 'onboarding_token'.

-- ─── patients: add missing profile columns ──────────────────────────────────

ALTER TABLE nodo_clinica.patients
  ADD COLUMN IF NOT EXISTS full_name  text,
  ADD COLUMN IF NOT EXISTS email      text,
  ADD COLUMN IF NOT EXISTS org_id     uuid;

-- ─── pending_clinic_registrations: normalize token column name ───────────────
-- The original migration named the column 'token'. The application code expects
-- 'onboarding_token'. Rename it if it still has the old name.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'nodo_clinica'
      AND table_name   = 'pending_clinic_registrations'
      AND column_name  = 'token'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'nodo_clinica'
      AND table_name   = 'pending_clinic_registrations'
      AND column_name  = 'onboarding_token'
  ) THEN
    ALTER TABLE nodo_clinica.pending_clinic_registrations
      RENAME COLUMN token TO onboarding_token;
  END IF;
END;
$$;

-- ─── admin_get_clinic_registrations RPC ─────────────────────────────────────
-- Exposed to nodo-landing admin panel. SECURITY DEFINER so it can read
-- nodo_clinica tables regardless of the caller's schema context.

CREATE OR REPLACE FUNCTION public.admin_get_clinic_registrations()
RETURNS TABLE (
  id              uuid,
  email           text,
  role            text,
  verified_at     timestamptz,
  onboarding_token uuid,
  expires_at      timestamptz,
  created_at      timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = nodo_clinica, public
AS $$
  SELECT
    id,
    email,
    role,
    verified_at,
    onboarding_token,
    expires_at,
    created_at
  FROM nodo_clinica.pending_clinic_registrations
  ORDER BY created_at DESC;
$$;

-- Allow authenticated users (the admin check is done in the API route, not here)
GRANT EXECUTE ON FUNCTION public.admin_get_clinic_registrations() TO authenticated;

-- admin_delete_clinic_registration — used by nodo-landing to remove completed registrations

CREATE OR REPLACE FUNCTION public.admin_delete_clinic_registration(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = nodo_clinica, public
AS $$
  DELETE FROM nodo_clinica.pending_clinic_registrations WHERE id = p_id;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_clinic_registration(uuid) TO authenticated;
