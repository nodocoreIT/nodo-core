-- Expose nodo_autos to PostgREST (fixes PGRST106 Invalid schema: nodo_autos).
-- App code uses supabase.schema('nodo_autos'). Tables already live in nodo_autos;
-- only the Data API schema list was missing this schema.

ALTER ROLE authenticator SET pgrst.db_schemas = 'public, shared, nodo_inmo, nodo_core, nodo_finanzas_personales, nodo_autos';
NOTIFY pgrst, 'reload config';
