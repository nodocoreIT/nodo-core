-- Separate logo for PDF documents (non-transparent, print-friendly).
-- Distinct from logo_path used in the app sidebar where transparency is fine.

alter table nodo_inmo.org_profiles
  add column if not exists pdf_logo_path text default null;
