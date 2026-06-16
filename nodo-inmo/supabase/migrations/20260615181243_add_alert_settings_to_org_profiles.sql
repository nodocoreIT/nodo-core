-- Migration: Add alert_settings to org_profiles
-- Add a new jsonb column for alert configurations
ALTER TABLE "nodo_inmo"."org_profiles" 
ADD COLUMN IF NOT EXISTS "alert_settings" JSONB DEFAULT '{"contractExpirationMonths": 2, "rentAdjustmentMonths": 1}'::jsonb;
