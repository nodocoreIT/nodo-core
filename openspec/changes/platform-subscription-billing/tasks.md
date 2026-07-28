# Tasks: Platform Subscription Billing (per client_unit)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1450-1750 total across all units (largest single unit ~280-320) |
| 400-line budget risk | High (aggregate) |
| Chained PRs recommended | Yes |
| Suggested split | 9 work units, PR 1 → PR 9 (see table below) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No (resolved — stacked-to-main, PR 1 of 9)
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | `nodo_core.fx_rates` table + refresh job + fallback chain | PR 1 | ~150-200 lines; independent, no consumers yet |
| 2 | `client_unit_subscriptions` + `subscription_payments` tables (nodo_core) | PR 2 | ~150-180 lines; additive, depends on PR 1 for FX column refs only by convention |
| 3 | `user_node_access_reason` RPC (new, additive) + `impago` status wiring | PR 3 | ~120-160 lines; `user_has_node_access` DDL untouched |
| 4 | RPC-drift CI guard + allowlist | PR 4 | ~60-100 lines; fully independent, can land any time |
| 5 | `shared-components` gate: `accessReason`/`billingLocked` + `isBillingWhitelistedPath` | PR 5 | ~150-200 lines; depends on PR 3 (reason RPC) |
| 6 | `nodo-landing` MP Preapproval helpers + webhook + reconciliation job (flagged off) | PR 6 | ~300-350 lines; largest unit, borderline over budget — flag if it grows |
| 7 | Finanzas Suscripción screen + redirect wiring | PR 7 | ~150-200 lines; depends on PR 5 |
| 8 | Autos Suscripción screen + redirect wiring | PR 8 | ~150-200 lines; depends on PR 5, template from PR 7 |
| 9a/9b | Inmo, then Clinica Suscripción screens + redirect wiring | PR 9a, PR 9b | ~150-200 lines each; depends on PR 5 |

Unit 6 (MP helpers + webhook + reconciliation job) is the one most likely to individually exceed 400
lines once tests are included — if so, split into 6a (Preapproval create/helpers) and 6b
(webhook + reconciliation job) before implementation.

## Phase 1: Foundation — Schema & FX Subsystem

- [x] 1.1 Create migration `nodo-landing/supabase/migrations/{ts}_fx_rates.sql`: `nodo_core.fx_rates(id, rate_date date, rate numeric(10,4), source text, created_at)`, unique `(rate_date, source)`, RLS via `is_team_member()`. Ref: spec `platform-billing` — FX Conversion.
- [x] 1.2 Add `nodo-landing/lib/billing/fx-rate.ts`: `resolveFxRate()` implementing fallback chain — (1) today's fetched rate → (2) most recent stored rate ≤ N days → (3) admin manual override row → (4) return explicit `fx-unavailable` result (never `0`, never throw). Unit test: all 4 branches, esp. "all missing → explicit failure, no charge, no crash". Ref: spec `platform-billing` — Scenario "FX rate unavailable at charge time".
- [x] 1.3 Add `nodo-landing/lib/billing/fetch-fx-rate.ts`: fetches dólar-tarjeta rate from external source (e.g. dolarapi.com), upserts into `fx_rates`. Wire into a daily refresh (reuse `app/api/cron/backup-orgs/route.ts`'s `Authorization: Bearer CRON_SECRET` pattern) — new `nodo-landing/app/api/cron/refresh-fx-rate/route.ts`.
- [x] 1.4 Create migration `nodo-landing/supabase/migrations/{ts}_client_unit_subscriptions.sql`: `nodo_core.client_unit_subscriptions` (per design schema — `client_unit_id` unique fk, `plane_id` fk to existing `nodo_core.planes`, `mp_preapproval_id` unique, `billing_currency`, `billing_amount`, `cycle_started_at`, `next_due_at`, `status`), RLS `is_team_member()`. Do NOT recreate or alter `nodo_core.planes`. Ref: spec `platform-billing` — Canonical Plan Pricing, One Preapproval per client_unit.
- [x] 1.5 Create migration `nodo-landing/supabase/migrations/{ts}_subscription_payments.sql`: `nodo_core.subscription_payments` (ledger, `UNIQUE(subscription_id, cycle_key, attempt_no)`), RLS `is_team_member()`. Ref: spec `platform-billing` — Payment History Ledger.
- [x] 1.6 Add TS type `'impago'` to the `client_unit` status union in `nodo-landing` (status column stays free-text per design; no enum/check needed) — locate and extend existing status union type, do not touch `client_units.status` column DDL.
- [x] 1.7 Run `supabase db advisors` (or MCP `get_advisors`) against the 3 new migrations before committing; fix any RLS/index findings. **Done** — migrations applied to production (`iprrlgmhpsxzyrejabtu`) via MCP `apply_migration` after Supabase MCP access was reconnected mid-session, then `get_advisors` run for both `security` and `performance`. Result: zero security findings on the 3 new tables; only expected `INFO`-level "Unused Index" (brand-new empty tables, no traffic yet) on `performance` — no action needed. No `WARN`/`ERROR` findings touch `fx_rates`, `client_unit_subscriptions`, or `subscription_payments`.

## Phase 2: node-access — Additive Reason RPC

- [x] 2.1 Create migration `nodo-landing/supabase/migrations/20260727200000_user_node_access_reason_rpc.sql`: new function `public.user_node_access_reason(p_unit_code text) returns text` (values `ok|payment_overdue|banned|invalid_credentials`). Uses `SECURITY DEFINER` (required — reads `auth.users.email`/`banned_until` for the current user, same as `user_has_node_access`), guarded by `where id = auth.uid()`. `public.user_has_node_access` DDL untouched — this migration only adds a new function; verified byte-identical against production via `pg_get_functiondef` before AND after applying (unchanged). **Discovery**: the LIVE `user_has_node_access` has a 4th fallback path (`shared.org_members`/`organizations` by product, for internal team members) not present in any tracked migration file — drifted from manual SQL-editor edits. Mirrored that 4th path in the new RPC (maps to `'ok'`, no status column applies there) so `reason` doesn't falsely report `invalid_credentials` for team-member logins. Advisors run against production: caught real `anon`-execute access on the new function (Supabase grants EXECUTE to `anon`/`authenticated` by schema default, separate from the `PUBLIC` pseudo-role — `revoke ... from public` alone doesn't strip it; same pre-existing gap exists on `user_has_node_access`, left as-is there) — fixed for the new function only via an explicit `revoke ... from anon`, confirmed via `has_function_privilege`. Remaining advisor WARN ("Signed-In Users Can Execute...") is expected/intentional and matches the existing RPC's same warning.
- [x] 2.2 Fail-open encoded in the RPC's own `exception when others then return 'ok'` handler (not the TS wrapper) — documented in the migration's header comment.
- [x] 2.3 Added `getNodeAccessReason(supabase, unitCode): Promise<NodeAccessReason>` to `packages/shared-components/src/lib/verify-node-access.ts` (+ re-exported from `src/index.ts`), calling the new RPC via `.schema("public").rpc(...)`, fail-open to `'ok'` on error/unrecognized value. `userHasNodeAccess`/`enforceNodeAccess` unchanged.
- [x] 2.4 Unit tests added at `nodo-landing/lib/auth/__tests__/node-access-reason.test.ts` (7 tests, all passing) — covers the TS wrapper's contract: `payment_overdue`, `banned`, `invalid_credentials`, `ok` pass through; RPC error and unrecognized value both fail open to `ok`; empty unitCode short-circuits without calling the RPC. The RPC's own status→reason SQL mapping is covered by the migration's inline logic + will be verified against production via `get_advisors` (no local Postgres available for pgTAP-style SQL tests in this repo). Ref: spec `node-access` — all 5 scenarios.

## Phase 3: RPC Drift CI Guard

- [x] 3.1 Created `.github/workflows/rpc-drift-guard.yml` (first workflow in the repo — no `.github/workflows` existed before). Triggers on PRs touching any `**/supabase/migrations/*.sql`; greps every migration file outside `nodo-landing/supabase/migrations/` for `function public.user_has_node_access` (case-insensitive), failing with `::error::` annotations listing offenders. Allowlists the 2 grandfathered nodo-inmo files by exact relative path. Verified locally (not just YAML-valid): confirmed it passes clean against the real repo, confirmed it genuinely catches an injected fake-violation file (temporarily created + removed), and confirmed the 2 allowlisted files DO match the grep pattern (so the allowlist is actually being exercised, not coincidentally passing). Ref: spec `node-access` — Single Source of Truth, both scenarios.
- [x] 3.2 Explanatory comment block at the top of the workflow references the actual incident (nodo-inmo migration `20260622120001` broke Autos/Finanzas login, restored by `20260623000002`) and states both are historical record, not permission for new drift.

## Phase 4: shared-components — Billing Lockout Gate

- [x] 4.1 Extended `packages/shared-components/src/providers/auth-provider.tsx`: added `accessReason: NodeAccessReason` and `billingLocked: boolean` (`accessReason === "payment_overdue"`) to `AuthContextValue`. Populated via `getNodeAccessReason` only after `userHasNodeAccess` grants access (so `payment_overdue` never overlaps with a real denial); forced to `"ok"`/`false` alongside `session`/`role` when `accessDenied`/`roleBlocked`. Fails open to `"ok"`/`false` since `getNodeAccessReason` itself fails open. Ref: spec `billing-lockout` — Session Survives payment_overdue.
- [x] 4.2 Added `packages/shared-components/src/lib/billing-whitelist.ts`: exports `SubscriptionRouteAllowlist` type + `isBillingWhitelistedPath(path, allowlist): boolean`. Pure function (trailing-slash-insensitive exact/sub-path match), no redirect logic. Ref: spec `billing-lockout` — Central Whitelisted-Route Enforcement.
- [x] 4.3 Added `packages/shared-components/src/hooks/use-billing-lockout.ts` (`useBillingLockout`): given `billingLocked` + `pathname` + `subscriptionPath` (string or array, optional), returns `{ shouldRedirect, redirectTo }`. Fails closed with `redirectTo: null` when no Suscripción path is configured yet — caller renders a generic notice instead of redirecting. Ref: spec `billing-lockout` — Missing Suscripción Screen Fails Safe.
- [x] 4.4 Unit tests added: `packages/shared-components/src/lib/__tests__/billing-whitelist.test.ts` (6 tests — exact/sub-path match, unrelated path, prefix-only false-positive guard, trailing slash, empty allowlist) and `packages/shared-components/src/hooks/__tests__/use-billing-lockout.test.ts` (6 tests — unlocked=allow all, locked+whitelisted=allow, locked+other=block, no-screen-configured=fail-closed, empty-array=fail-closed, multi-route allowlist). 12/12 passing via `pnpm test` (added `vitest` devDependency + `vitest.config.ts` to the package — it had no test runner before this change). Ref: spec `billing-lockout` — all 6 scenarios.
- [x] 4.5 Documented via JSDoc on `useBillingLockout` in `use-billing-lockout.ts`: explicitly states this hook is client-side only and that spec requirement "Server-Side (API) Enforcement" is each nodo's own responsibility to wire (middleware/route check using `AuthContextValue.billingLocked`/`accessReason` + `isBillingWhitelistedPath`) — the shared package only exposes the state and the matcher, it does not run on the server. No new `.md` file added.

Both `npx tsc --noEmit -p .` (clean — package has no dedicated `typecheck` script) and `pnpm build` (tsup) pass for `@nodocore/shared-components` with these changes. All new exports (`accessReason`, `billingLocked`, `isBillingWhitelistedPath`, `SubscriptionRouteAllowlist`, `useBillingLockout`, `UseBillingLockoutOptions`, `BillingLockoutResult`) are re-exported from `packages/shared-components/src/index.ts`. Wiring this into an actual nodo layout (Suscripción screen + redirect + API middleware) is per-nodo work tracked in later phases, not part of Phase 4.

## Phase 5: nodo-landing — Billing Engine

- [ ] 5.1 Add `nodo-landing/lib/billing/mp-preapproval.ts`: `createPreapproval(clientUnitId)` — mirrors `nodo-clinica`'s `nodo-clinica/src/lib/mercadopago/client.ts` pattern, uses NODO's own MP token (not client's), resolves price via `nodo_core.planes` (Phase 1.4) and `resolveFxRate` (Phase 1.2), sets `billing_day` from `client_units.enabled_at` with month-end clamping. Ref: spec `platform-billing` — One Preapproval per client_unit, both scenarios.
- [ ] 5.2 Add `nodo-landing/app/api/mp/subscription-webhook/route.ts` (separate route from any existing clinica webhook): validates MP signature, matches `mp_preapproval_id`, on `approved` writes `subscription_payments` row + sets `active`/resets cycle from payment date; on terminal failure defers to reconciliation job for the actual `impago` transition (webhook alone doesn't have full MP retry-exhaustion visibility). Idempotent on `(subscription_id, cycle_key, attempt_no)`. Ref: spec `platform-billing` — Reacting to MP's Recurring Billing Outcome, Successful Payment Resets the Cycle.
- [ ] 5.3 Add `nodo-landing/app/api/cron/billing-reconciliation/route.ts`: `Authorization: Bearer CRON_SECRET` (same pattern as `backup-orgs`), daily job selecting subscriptions where `now >= anniversary + 30 days` and latest cycle payment isn't `approved`; confirms MP terminal state via `getPreapproval`/authorized_payments before flipping `impago`; `for update skip locked`; feature-flagged off initially (env-gated no-op). Ref: spec `platform-billing` — day-30 checkpoint, idempotent re-run scenario.
- [ ] 5.4 On `impago` transition, send dunning email (reuse existing mail util) — idempotent, only sent once per cycle transition. Ref: spec `platform-billing` — Scenario "MP reports a terminal failure for the cycle".
- [ ] 5.5 Tests: FX-unavailable charge attempt records failure in `subscription_payments` and does not create/renew a Preapproval; reconciliation re-run does not duplicate email/history; webhook approved-payment resets cycle from payment date not original anniversary. Ref: spec `platform-billing` — all remaining scenarios not covered above.

## Phase 6: Per-Nodo Suscripción Screens (phased rollout — one PR per nodo)

- [ ] 6.1 **Finanzas**: add "Configuración → Suscripción" screen showing plan/status/next charge + wire billing-lockout gate (Phase 4.3) into Finanzas' route layout with its Suscripción path registered in the allowlist. First nodo — validates the shared gate end-to-end (single plan, lowest complexity).
- [ ] 6.2 **Autos**: same screen + gate wiring, using Finanzas' implementation as the template.
- [ ] 6.3 **Inmo**: same screen + gate wiring.
- [ ] 6.4 **Clinica**: same screen + gate wiring — verify it does NOT interact with/modify the existing `professionals`-based Preapproval flow (out of scope, untouched).
- [ ] 6.5 Per nodo (each of 6.1-6.4): E2E check that normal (non-impago) login for that nodo is unaffected, and that `impago` login redirects everywhere except Suscripción. Ref: spec `billing-lockout` — Blocked route redirects, Suscripción route itself is allowed.

## Phase 7: Cross-Nodo Regression

- [ ] 7.1 After Phase 2 ships (before any per-nodo screen work), manually verify login for all 5 nodos (Landing, Finanzas, Autos, Inmo, Clinica) against `activo`, `pausado`, `sin_acceso` units — confirm byte-identical behavior to pre-change. Ref: spec `node-access` — Scenario "existing caller ignoring reason is unaffected".
- [ ] 7.2 Verify `nodo-clinica`'s existing `professionals`-based Preapproval/webhook flow is untouched by any Phase 5 file additions (new files only, no shared file edits in that flow).
