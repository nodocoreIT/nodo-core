-- Document the new "sin_acceso" status: set when an admin deletes a nodo
-- user from Usuarios — credentials are cleared but the client_units row is
-- kept for history. Distinct from "pausado" (a reversible business pause
-- with credentials intact). No schema change: status stays free-text.
comment on column nodo_core.client_units.status is
  'pending_review | pending_onboarding | onboarding | activo | pausado | sin_acceso';
