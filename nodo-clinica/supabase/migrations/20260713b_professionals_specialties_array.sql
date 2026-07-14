-- Migration: add specialties[] array column to professionals
-- The existing 'specialty' text column stays for backwards compatibility.
-- The new 'specialties' text[] column holds multiple specialties.
-- On read, if specialties is empty, we fall back to [specialty].

ALTER TABLE nodo_clinica.professionals
  ADD COLUMN IF NOT EXISTS specialties text[] NOT NULL DEFAULT '{}';

-- Backfill: migrate existing single specialty values into the array
UPDATE nodo_clinica.professionals
  SET specialties = ARRAY[specialty]
  WHERE specialty IS NOT NULL
    AND specialty <> ''
    AND (specialties IS NULL OR specialties = '{}');
