-- dismissed_panel_notifications was created in the public schema, but every
-- app client (lib/supabase/client.ts, lib/supabase/server.ts) is scoped to
-- db.schema: "nodo_core" (see lib/supabase/panel-auth.ts). Every read/write
-- to this table has been 404ing against PostgREST ever since — the table
-- was empty (0 rows), confirming dismiss has never actually persisted.
-- Moving the table (not recreating it) preserves its constraints/RLS as-is.

alter table public.dismissed_panel_notifications set schema nodo_core;
