-- Expose nodo_tienda via PostgREST Data API.
-- Without this, supabase-js schema("nodo_tienda") calls fail after login.
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, nodo_inmo, nodo_core, nodo_finanzas_personales, nodo_autos, nodo_tienda';
NOTIFY pgrst, 'reload config';
