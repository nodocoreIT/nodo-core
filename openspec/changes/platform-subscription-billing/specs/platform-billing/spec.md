# Platform Billing Specification

## Purpose

Recurring, per-`client_unit` subscription billing via MercadoPago Preapproval, billed against
NODO's own MP account (never the client's), replacing today's fully manual pause/reactivate flow.
Anniversary-based cycles, automatic dunning, and a payment history ledger. Out of scope:
`nodo-clinica`'s existing `professionals`-based Preapproval flow (untouched, pattern reference only).

## Requirements

### Requirement: Canonical Plan Pricing

The system MUST resolve a `client_unit`'s billing amount from a single canonical price list keyed
by `(unit_code, plan code)`, with one fixed price per plan (no per-client negotiated pricing).
`nodo_core.planes` already serves this role for panel/onboarding display; this capability MUST
reuse it (extended with any billing-specific fields) as the pricing source of truth rather than
introducing a second, parallel prices table.

#### Scenario: Resolve price for an active plan

- GIVEN a `client_unit` with `unit_code = "Inmo"` and `plan = "pro"`
- WHEN the billing engine resolves the charge amount for a cycle
- THEN it MUST use the current `price_monthly` (or `price_annual_monthly` for yearly billing) from `nodo_core.planes` where `is_active = true`

#### Scenario: Plan missing or inactive

- GIVEN a `client_unit` referencing a plan code with no active row in `nodo_core.planes`
- WHEN a charge attempt is due
- THEN the system MUST fail the attempt with a configuration error and MUST NOT create a Preapproval or charge

### Requirement: FX Conversion at Charge Time (USD to ARS)

Plans in `nodo_core.planes` are priced in USD. MercadoPago charges Argentine cards in ARS, so the
system MUST convert the USD plan price to ARS using the prevailing "dólar tarjeta" rate at the
moment of debit. No FX-rate source exists in the codebase today; this capability MUST introduce
one as an explicit dependency (source and refresh cadence are a design decision). If no FX rate
can be resolved at charge time, the system MUST NOT charge $0, MUST NOT silently skip the cycle,
and MUST NOT crash the billing flow — the attempt MUST fail explicitly with a distinguishable
error/reason, be recorded in the payment history, and remain eligible for the next reconciliation
check rather than being lost.

#### Scenario: FX rate resolves successfully

- GIVEN an available "dólar tarjeta" rate at charge time
- WHEN the system computes the ARS amount for a USD plan price
- THEN it MUST charge `price_usd * rate` and MUST record the rate used alongside the payment history entry

#### Scenario: FX rate unavailable at charge time

- GIVEN the FX-rate source is unreachable or stale when a charge is due
- WHEN the system attempts to resolve the ARS amount
- THEN the charge attempt MUST fail explicitly with a distinct FX-unavailable error, MUST NOT charge $0, and MUST be recorded in payment history as failed for that reason

### Requirement: One Preapproval per client_unit, Anniversary Billing

The system MUST create exactly one active MercadoPago Preapproval per `client_unit`, scoped to
that unit's plan, using NODO's MP account as payer of record (mirrors `nodo-clinica`'s
`createPreapproval` pattern). `billing_day` MUST be derived from the unit's activation date
(anniversary cycle), not a shared calendar-fixed day.

#### Scenario: billing_day set from activation

- GIVEN a `client_unit` activated on the 15th of a month
- WHEN its Preapproval is created
- THEN `billing_day` MUST be 15, independent of other units' cycles

#### Scenario: Activation day has no equivalent in a shorter month

- GIVEN a `client_unit` activated on day 31
- WHEN a subsequent cycle falls in a month with fewer than 31 days
- THEN `billing_day` MUST clamp to that month's last day for that cycle only

### Requirement: Reacting to MercadoPago's Recurring Billing Outcome (Dunning)

MercadoPago's Preapproval `auto_recurring` engine — the same mechanism `nodo-clinica`'s existing
flow already relies on — owns the actual recurring charge and its own retry cadence.
`nodo-landing` MUST NOT implement a separate custom charge-attempt/retry loop; it reacts to what
MP reports. Starting around cycle-relative day 30 (calendar days elapsed since the `client_unit`'s
activation/anniversary date), a scheduled job in `nodo-landing`, authorized via
`Authorization: Bearer CRON_SECRET` (same pattern as `app/api/cron/backup-orgs/route.ts`), MUST
detect and react to MP's reported outcome for that cycle via webhook notification and/or a
reconciliation poll against the Preapproval's payment status. When MP reports a terminal failure
for the cycle (MP has exhausted its own retry cadence without a successful charge), the system
MUST set the unit's status to `impago` and MUST send a dunning notification email to the client.
This reaction MUST be idempotent per cycle — re-processing an already-resolved cycle MUST NOT
duplicate the status transition, the notification, or the history entry.

#### Scenario: MP reports a terminal failure for the cycle

- GIVEN a `client_unit` whose cycle MP has reported as a terminal failure (all of MP's own retries exhausted, no successful charge)
- WHEN `nodo-landing` processes that outcome (webhook and/or reconciliation poll)
- THEN the system MUST set the unit's status to `impago` and MUST send a dunning notification email to the client

#### Scenario: Reconciliation re-run does not duplicate the reaction

- GIVEN a cycle whose terminal-failure outcome was already processed (unit already `impago`, notification already sent)
- WHEN the reconciliation poll runs again for that same cycle
- THEN the system MUST NOT send a duplicate notification or create a duplicate history entry

### Requirement: Successful Payment Resets the Cycle

Any successful charge, however `nodo-landing` learns of it (MP webhook notification or
reconciliation poll — MP itself owns the charge), MUST set the unit's status to `activo` and MUST
reset the next `billing_day` cycle to count from the payment date, not the original anniversary.

#### Scenario: Manual/out-of-band payment reactivates

- GIVEN an `impago` unit
- WHEN MercadoPago reports a successful payment for its Preapproval via webhook
- THEN the unit MUST transition to `activo` and the next cycle MUST be counted from that payment date

### Requirement: Payment History Ledger

The system MUST record every payment outcome reported by MercadoPago (webhook notification or
reconciliation poll) per `client_unit` — including the cycle, timestamp, and outcome
(success/failure/pending) — in an append-only history readable for support and audit purposes.
FX-unavailable failures (see FX Conversion requirement) MUST also be recorded here.

#### Scenario: Reported failure is recorded

- GIVEN MP reports a failed payment outcome for a `client_unit`'s cycle
- WHEN `nodo-landing` processes that outcome
- THEN a history row MUST exist showing `client_unit_id`, timestamp, and the failure outcome
