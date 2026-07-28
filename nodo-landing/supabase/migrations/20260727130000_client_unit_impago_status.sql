-- Document the new "impago" status: set by the billing reconciliation job
-- (platform-subscription-billing, Phase 5) when MercadoPago reports a
-- terminal failure for a client_unit's billing cycle. Access stays allowed
-- (user_has_node_access is unaffected by this status); only the additive
-- reason RPC (Phase 2) surfaces it, so nodos can gate non-Suscripción routes.
-- No schema change: status stays free-text, same as the "sin_acceso" precedent.
comment on column nodo_core.client_units.status is
  'pending_review | pending_onboarding | onboarding | activo | pausado | sin_acceso | impago';
