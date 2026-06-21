-- Restore shared schema in PostgREST (required for shared.nodo_id, org_members, etc.).
-- Migration 20260618120000 accidentally omitted shared from pgrst.db_schemas.

ALTER ROLE authenticator SET pgrst.db_schemas = 'public, shared, nodo_inmo, nodo_core, nodo_finanzas_personales';
NOTIFY pgrst, 'reload config';
