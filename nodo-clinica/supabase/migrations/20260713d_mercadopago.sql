-- Migration: MercadoPago integration
-- Creates payment_credentials table and adds MP payment columns to appointments.

-- ─── payment_credentials ────────────────────────────────────────────────────
-- Stores per-org MercadoPago OAuth tokens (access_token, refresh_token, etc.)
-- Always accessed via service_role — RLS blocks authenticated reads by design.

CREATE TABLE IF NOT EXISTS nodo_clinica.payment_credentials (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL,
  access_token     text        NOT NULL,
  refresh_token    text,
  public_key       text,
  token_expires_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_credentials_org_id_unique UNIQUE (org_id)
);

-- FK to shared.organizations (org_id lives in the shared schema)
ALTER TABLE nodo_clinica.payment_credentials
  ADD CONSTRAINT payment_credentials_org_id_fk
  FOREIGN KEY (org_id)
  REFERENCES shared.organizations (id)
  ON DELETE CASCADE;

-- RLS: enabled, no policies → only service_role can read/write
ALTER TABLE nodo_clinica.payment_credentials ENABLE ROW LEVEL SECURITY;

-- ─── appointments: MercadoPago payment columns ───────────────────────────────

ALTER TABLE nodo_clinica.appointments
  ADD COLUMN IF NOT EXISTS payment_status           text
    CHECK (payment_status IN ('pending', 'confirmed', 'waived')),
  ADD COLUMN IF NOT EXISTS payment_confirmed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS payment_provider         text,
  ADD COLUMN IF NOT EXISTS mercadopago_preference_id text,
  ADD COLUMN IF NOT EXISTS mercadopago_payment_id   text;
