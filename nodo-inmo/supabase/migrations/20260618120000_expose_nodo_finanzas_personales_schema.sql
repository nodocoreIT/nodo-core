-- Expose nodo_finanzas_personales via PostgREST Data API.
-- Without this, supabase-js schema("nodo_finanzas_personales") calls fail after login.
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, nodo_inmo, nodo_core, nodo_finanzas_personales';
NOTIFY pgrst, 'reload config';
