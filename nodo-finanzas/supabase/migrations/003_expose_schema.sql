-- Expose nodo_finanzas_personales via PostgREST Data API (shared Supabase project).
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, nodo_inmo, nodo_core, nodo_finanzas_personales';
NOTIFY pgrst, 'reload config';
