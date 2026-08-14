-- Migration: add DNI front/back storage paths to professionals
-- Mirrors patients.dni_front_path / patients.dni_back_path (see
-- 20260711_clinica_registration.sql) so médico onboarding can capture the
-- same DNI photo upload as paciente onboarding.

ALTER TABLE nodo_clinica.professionals
  ADD COLUMN IF NOT EXISTS dni_front_path text,
  ADD COLUMN IF NOT EXISTS dni_back_path  text;
