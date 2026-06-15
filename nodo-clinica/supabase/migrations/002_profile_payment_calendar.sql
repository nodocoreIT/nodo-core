-- Add payment, calendar and availability fields to profiles
-- These are doctor-specific settings not present in the initial schema

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS consultation_fee     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS currency             TEXT DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS alias                TEXT,
  ADD COLUMN IF NOT EXISTS cbu                  TEXT,
  ADD COLUMN IF NOT EXISTS bank_name            TEXT,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT,
  ADD COLUMN IF NOT EXISTS qr_image_url         TEXT,
  ADD COLUMN IF NOT EXISTS require_payment_before_booking BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mercadopago_enabled  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS google_calendar_id   TEXT,
  ADD COLUMN IF NOT EXISTS reminder_enabled     BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS reminder_minutes_before INTEGER DEFAULT 1440,
  ADD COLUMN IF NOT EXISTS blocked_dates        JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS photo_url            TEXT;
