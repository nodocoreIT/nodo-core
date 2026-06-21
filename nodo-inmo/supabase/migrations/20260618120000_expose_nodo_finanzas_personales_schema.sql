-- Expose nodo_finanzas_personales via PostgREST Data API.
-- Without this, supabase-js schema("nodo_finanzas_personales") calls fail after login.
-- Empty schema placeholder for Inmo-only local DB (finanzas migrations live elsewhere).
CREATE SCHEMA IF NOT EXISTS nodo_finanzas_personales;
GRANT USAGE ON SCHEMA nodo_finanzas_personales TO authenticated, service_role;

ALTER ROLE authenticator SET pgrst.db_schemas = 'public, shared, nodo_inmo, nodo_core, nodo_finanzas_personales';
NOTIFY pgrst, 'reload config';
