# Design: Platform Subscription Billing (per client_unit)

## Technical Approach

Per-`client_unit` recurring billing on NODO's own MercadoPago account, driven by MP
Preapproval native **`auto_recurring`** (MP owns charge timing AND its own retry cadence —
same pattern as `nodo-clinica`'s existing flow). `nodo-landing` runs only a
**reactive reconciliation job** (webhook-first, poll safety-net) that READS MP status and
flips `impago` — it never initiates a charge itself. Access stays gated by the **untouched**
boolean RPC `user_has_node_access`; a **new additive companion RPC** carries the
machine-readable `reason`, so a bad billing deploy can never sign anyone out. Reuse the
existing `nodo_core.planes` catalog (USD) — do NOT build a second plans table.

## Correction to proposal (grounded in code)

`nodo_core.planes` ALREADY exists (`20260619160000_node_planes.sql`, USD, per-nodo,
`is_team_member` RLS). Treat it as the price catalog. `client_units.status` is free-text
(no enum/check), so adding `impago` is a comment + TS-union change only.

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|----------|--------|----------|-----------|
| 1 | Plans table | Reuse `nodo_core.planes`; add `client_unit_subscriptions` + `subscription_payments` for state | New `plans/prices` table | Avoids drift/duplication; catalog already live |
| 2 | New status | `impago` (confirmed) | Reuse `pausado`/`sin_acceso` | Distinct semantics; RPC already special-cases only `pausado` |
| 3 | Billing engine | MP native `auto_recurring` Preapproval (MP charges + retries); one Preapproval per unit, NODO token, separate webhook route + separate `mp_preapproval_id` column | Custom day-by-day charge cron | MP owns collection & retry; reuses clinica's proven pattern; clinica `professionals` flow untouched |
| 4 | Enforcement job | **Reactive**: webhook-first + daily poll safety-net; flips `impago` from MP terminal status. Never triggers a charge | Self-driven retry loop | MP already recycles/retries failed invoices; a self-loop would double-charge |
| 5 | Billing anchor | `client_units.enabled_at`, AR timezone; "day 30" = 30 calendar days elapsed since the anniversary charge → reconciliation checkpoint | Day-of-month; self-initiated retry days | MP `frequency:1 months` owns the cycle; day 30 is only when landing checks if MP collected |
| 6 | reason transport | **New** RPC `user_node_access_reason`; leave `user_has_node_access` DDL byte-for-byte unchanged | Modify existing RPC to return reason | Existing RPC is the drift-scarred, all-nodo critical path — never touch its body |
| 7 | Lockout gate | Shared provider exposes `accessReason`/`billingLocked` + whitelist matcher (state only, no redirect); each nodo owns screen + redirect wiring | Central redirect | Screen is per-nodo; central redirect can't know each nodo's routes |
| 8 | Drift CI | Grep non-landing `supabase/migrations/*.sql` for `function public.user_has_node_access`, allowlisting the 2 grandfathered inmo files | Fail on any match | Two inmo migrations legitimately still contain it |
| 9 | FX (USD→ARS) | Snapshot ARS = USD price × "dólar tarjeta" rate on debit day; new `fx_rates` source + fallback | Charge USD directly / hardcode ARS | Catalog is USD; MP debits ARS at card-dollar rate; no FX source exists in repo today |
| 10 | Rollout | Phased, not big-bang | All nodos in one PR | Blast radius + 400-line budget + validate on Finanzas first |

## New schema (nodo_core)

```
client_unit_subscriptions
  id uuid pk, client_unit_id uuid unique fk→client_units, plane_id uuid fk→planes,
  mp_preapproval_id text unique, billing_currency text not null default 'ARS',
  billing_amount numeric(12,2) not null,           -- ARS charged, snapshot (planes is USD)
  cycle_started_at timestamptz not null, next_due_at timestamptz not null,
  status text not null default 'active',           -- active|past_due|paused
  created_at/updated_at timestamptz. RLS: is_team_member() (service-role writes via admin client).

subscription_payments  (idempotent ledger)
  id uuid pk, subscription_id fk, cycle_key text,   -- e.g. '2026-07' anniversary cycle
  attempt_no int not null, mp_payment_id text, amount numeric(12,2),
  status text not null,                             -- pending|approved|rejected
  created_at timestamptz. UNIQUE (subscription_id, cycle_key, attempt_no).
```
`billing_amount`/`billing_currency` snapshot the actual ARS debited: at each cycle the
value = `planes.price_monthly` (USD) × dólar-tarjeta rate on debit day, written when the
Preapproval is created/renewed. `subscription_payments` mirrors MP invoice/payment status
(no self-initiated charges); the ledger is a reconciliation record, not a charge queue.

## External dependencies (new)

| Dependency | Use | Fallback |
|-----------|-----|----------|
| MP Preapproval `auto_recurring` + webhooks (NODO token) | recurring charge + retry, source of truth | poll `getPreapproval`/authorized_payments as safety-net for missed webhooks |
| Dólar-tarjeta FX rate | USD catalog → ARS debit amount | see below |

**FX rate source**: no rate exists in the repo today. Add `nodo_core.fx_rates` (date, rate,
source) refreshed daily from a public API (e.g. dolarapi.com "tarjeta") via the reconciliation
job, with an admin-editable manual override row. **Fallback order at debit time**: (1) today's
fetched rate → (2) most recent stored rate ≤ N days old → (3) admin manual rate. If ALL are
missing/stale: do NOT charge $0 and do NOT crash — skip this unit's renewal, log, and alert
the team; the existing Preapproval keeps MP's last known ARS amount until a rate is available.

## Data flow

```
MP auto_recurring ─webhook→ /api/mp/preapproval/webhook → match mp_preapproval_id
     │ authorized/approved → status=activo, record payment, cycle advances (MP-driven)
     │ rejected → MP recycles/retries automatically (MP owns the retry cadence)
     ↓ (day 30: 30 calendar days since anniversary, MP has not collected)
Reconciliation job (daily, Bearer CRON_SECRET, safety-net poll of MP status)
     MP terminal-failed / preapproval paused → client_units.status='impago' + email
Login → user_has_node_access (TRUE for impago) + user_node_access_reason='payment_overdue'
     → shared gate sets billingLocked → nodo redirects all routes but Suscripción
```

## Algorithms

- **Anniversary cycle**: MP `auto_recurring frequency:1 frequency_type:months` owns charge
  dates (auto-clamps month-end). Anchor = `client_units.enabled_at`. Day boundaries in
  `America/Argentina/Buenos_Aires`; store `timestamptz`.
- **Day-30 checkpoint / impago transition**: reconciliation job selects units whose latest MP
  payment for the current cycle is not `approved` and where `now ≥ anniversary + 30 days`;
  confirms via `getPreapproval`/authorized_payments that MP's own retries are terminally
  exhausted (invoice not `recycling`), then sets `impago`. `for update skip locked` avoids
  overlap; webhook is source of truth, the poll only reconciles missed events. Idempotent:
  keyed on `(subscription_id, cycle_key)` — re-running never double-writes or double-charges
  (it issues no charge at all).

## Interfaces (shared-components — additive)

```ts
type NodeAccessReason = 'ok' | 'payment_overdue' | 'banned' | 'invalid_credentials';
// enforceNodeAccess keeps {ok, message}; adds optional reason. userHasNodeAccess unchanged.
// AuthContext gains: accessReason: NodeAccessReason; billingLocked: boolean;
// Shared exports: SUBSCRIPTION_ROUTE_ALLOWLIST, isBillingWhitelistedPath(path): boolean
```
Companion-RPC error/missing ⇒ reason `'ok'` (fail-open). Boolean RPC remains sole access
decision, so reason logic can never lock a user out.

## Rollout sequencing (blast-radius ordered)

1. DB: new tables + `user_node_access_reason` RPC (additive; nothing consumes it → zero risk).
2. shared-components: additive `reason` + `billingLocked` state, fail-open. Ship, verify all 5 logins.
3. landing: FX source + MP Preapproval helpers, webhook, reconciliation job (feature-flagged off).
4. Per-nodo Suscripción screen + redirect wiring — **phased**, one nodo per PR.
5. RPC-drift CI guard (independent, any time).

## Phasing recommendation (deferred decision)

**Recommend phased per-nodo rollout.** Tradeoffs:

| Option | Pros | Cons |
|--------|------|------|
| Phased (recommended) | Fits 400-line budget; validate on Finanzas (single plan) first; per-nodo failure isolated | Temporarily mixed UX across nodos |
| Big-bang one PR-chain | Uniform UX at once | Huge diff; one nodo's bug blocks all; higher lockout risk |

Central contract + landing billing + shared gate first; then roll the screen nodo-by-nodo,
Finanzas → Autos → Inmo → Clinica.

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | day-30 checkpoint, FX fallback order (stale/missing rate never charges $0), `isBillingWhitelistedPath` | pure fns |
| Integration | reconciliation job re-run safety, webhook status mapping, reason RPC | seeded DB + MP sandbox |
| E2E | login of all 5 nodos unaffected; `impago` traps to Suscripción; payment reactivates | per-nodo |

## Open Questions

RESOLVED: (1) billing engine = MP native `auto_recurring`, landing is reactive-only; (2) day
= 30 calendar days since anniversary; (3) FX = USD × dólar-tarjeta on debit day with tiered fallback.

Remaining verification at implementation time (no design blocker):
- [ ] Confirm exact MP field names/values for a terminally-failed recurring charge
  (`authorized_payments` status `recycling` vs terminal, preapproval auto-`paused`) so the
  day-30 impago trigger reads MP's real terminal state, not a mid-retry state.
- [ ] Confirm the dólar-tarjeta public source + staleness threshold `N` days for fallback (2).
