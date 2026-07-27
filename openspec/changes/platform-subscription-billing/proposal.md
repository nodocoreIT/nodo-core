# Proposal: Platform Subscription Billing (per client_unit)

## Why

Platform revenue is billed 100% manually today. Pausing/reactivating a subscription is a
one-`client_unit`-at-a-time admin toggle (`nodo-landing/app/api/admin/client-unit-status/route.ts`),
there is no recurring charge, no central price list, and no automatic dunning. This does not scale
as the number of contracted nodos grows. We need real recurring subscription billing, scoped per
contracted nodo (`client_unit`), with automatic retry, automatic pause on non-payment, and
self-service reactivation — without touching the shared login of every nodo unsafely.

Note: `nodo-clinica`'s existing MercadoPago Preapproval flow (tied to `professionals.subscription_status`)
is the WRONG population for this — it stays as-is and is only a pattern reference.

## What Changes

- **Per-`client_unit` recurring billing** via MercadoPago Preapproval (one Preapproval per unit,
  against NODO's MP account), with `billing_day` derived from each unit's activation date
  (anniversary cycle, not calendar-fixed).
- **New `client_unit` status** for payment-driven pause — distinct from `pausado` (manual, reversible
  business pause) and `sin_acceso` (credentials wiped). Recommended value `impago` (final name in design).
- **Central plans/prices table** in `nodo_core` schema (does not exist today; `nodo-clinica` hardcodes
  ARS amounts). Fixed price per plan, global — no per-client negotiated pricing.
- **Centralized dunning cron** in `nodo-landing` (`Authorization: Bearer CRON_SECRET`, same pattern as
  `app/api/cron/backup-orgs/route.ts`): day 31 first charge attempt, daily retries days 32–36 inclusive
  (5 attempts), then pause the unit → `impago` + notify email. Successful charge → `activo` and cycle
  resets from the payment date.
- **Shared access contract extension**: `enforceNodeAccess`/`user_has_node_access` return a
  machine-readable `reason` (`payment_overdue` vs `banned`/`invalid_credentials`) so each nodo can show
  a specific "paused for non-payment" modal instead of the generic invalid-access message.
- **Billing lockout with one whitelisted route** (Netflix/Slack pattern): when a unit is `impago`,
  login to that nodo blocks everything EXCEPT "Configuración → Suscripción". Whitelisting lives in the
  shared gate; the screen itself is per-nodo.
- **RPC drift mitigation**: designate `nodo-landing` as the single source of truth for
  `user_has_node_access`; forbid per-repo redefinition; add a CI guard that fails if the function DDL
  appears in any non-landing migration (a nodo-inmo migration already overwrote it once, breaking
  Autos/Finanzas login).

### New Capabilities
- `platform-billing`: central plans/prices, per-`client_unit` Preapproval, dunning cron, payment history.
- `billing-lockout`: shared `reason`-aware access gate + whitelisted Suscripción route.

### Modified Capabilities
- `node-access`: `enforceNodeAccess`/`user_has_node_access` gain a machine-readable `reason`; new
  `impago` status recognized. Runs on EVERY login of EVERY nodo — breaking-change risk is high.

## Impact

| Area | Impact | Description |
|------|--------|-------------|
| `nodo-landing` (`nodo_core` schema, migrations) | New/Modified | Plans table, `client_unit` status, dunning cron, canonical RPC, MP Preapproval helpers |
| `packages/shared-components` (`verify-node-access.ts`, `auth-provider.tsx`) | Modified | `reason` code + whitelisted-route gate — CENTRAL, one change covers all nodos |
| Each nodo | New (per-nodo) | Own "Configuración → Suscripción" screen (access whitelisting is central) |
| `nodo-clinica` Preapproval-by-`professionals` | Untouched | Out of scope |

## Out of Scope
- Migrating/deprecating `nodo-clinica`'s `professionals` Preapproval flow.
- Building the full Suscripción screen in EVERY nodo at once — propose phasing: central contract +
  landing billing first, then roll the screen per nodo (decision deferred to design).
- Per-client negotiated pricing, proration, multi-currency, invoices/AFIP.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Change to shared login breaks all nodos | High | Additive `reason`; keep default behavior; test each nodo login |
| Shared RPC drift recurs | Med | Single source of truth + CI guard |
| Failed charge falsely pauses a paying client | Med | Idempotent cron, MP webhook reconciliation, 5-day grace |
| Status confusion (`impago` vs `pausado`/`sin_acceso`) | Med | New dedicated status; never reuse existing ones |

## Rollback Plan

Feature-flag the dunning cron (disable → no auto-charges/pauses). The `reason` field is additive:
revert `shared-components` to return the generic message. New status/plans table are additive; leaving
units `activo` restores manual billing. Revert canonical-RPC migration to prior definition if login regresses.

## Dependencies
- MercadoPago Preapproval API + webhook (NODO's MP account) — pattern exists in `nodo-clinica`.
- `CRON_SECRET` env + scheduler (Vercel Cron).

## Success Criteria
- [ ] A `client_unit` auto-charges on its anniversary day 31 with correct fixed plan price.
- [ ] 5 daily retries then auto-pause to `impago` + email on continued failure.
- [ ] `impago` login blocks all routes except Suscripción; other nodos' logins unaffected.
- [ ] Successful payment (auto or manual) reactivates access via webhook and resets the cycle.
- [ ] `user_has_node_access` has a single owner + CI guard preventing drift.
