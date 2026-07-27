# Delta for node-access

No formal `openspec/specs/node-access/spec.md` exists yet — this delta's "Previously" lines are
derived from current behavior in `public.user_has_node_access` (nodo-landing migrations) and
`packages/shared-components/src/lib/verify-node-access.ts`, which runs on EVERY login of EVERY
nodo. Breaking-change risk is high; every requirement below is additive by design.

## MODIFIED Requirements

### Requirement: Cross-Nodo Login Access Check

On every login attempt to any nodo, the system MUST verify that the authenticated user's email is
registered for the requested `unit_code` via the `user_has_node_access` RPC, and MUST also report
a machine-readable `reason` for denial or restriction, distinguishing `payment_overdue` (unit is
`impago`) from `banned` (auth account banned) and `invalid_credentials` (no matching access row,
or unit `pausado`/`sin_acceso`). `impago` MUST NOT be treated as full denial: unlike `pausado`
(access fully denied, session signed out) and `sin_acceso` (credentials already wiped, login fails
before this check runs), an `impago` unit MUST allow the RPC/`enforceNodeAccess` check to succeed
(no sign-out) so the separate `billing-lockout` capability can restrict routes instead of blocking
login outright. The `reason` MUST be delivered additively (e.g., a new field on the existing
return value, or a new companion function/RPC overload) — existing exported signatures
(`userHasNodeAccess(): Promise<boolean>`, `enforceNodeAccess(): Promise<{ok:true} | {ok:false; message:string}>`)
and the boolean-returning `user_has_node_access(text)` RPC MUST continue to exist and behave
identically for every status that existed before this change (`pending_review`,
`pending_onboarding`, `onboarding`, `activo`, `pausado`, `sin_acceso`).
(Previously: checked email + `unit_code` match and excluded only `status = 'pausado'`, returning a
plain boolean with no reason; any non-`pausado`, matching row granted access.)

#### Scenario: pausado unit is unaffected

- GIVEN a `client_unit` with status `pausado`
- WHEN its user attempts to log in to that nodo
- THEN access MUST be denied and the session signed out, exactly as before this change

#### Scenario: impago unit is allowed through the access check

- GIVEN a `client_unit` with status `impago`
- WHEN its registered user logs in to that nodo
- THEN `user_has_node_access`/`enforceNodeAccess` MUST report access allowed with `reason = "payment_overdue"`, and MUST NOT sign the user out

#### Scenario: banned auth account

- GIVEN a user whose Supabase auth account is banned
- WHEN they attempt to log in
- THEN the system MUST deny access with `reason = "banned"`, matching today's `BANNED_MESSAGE` flow

#### Scenario: no matching access row

- GIVEN a user with no `node_email_access`/`client_units` row for the requested `unit_code`
- WHEN they attempt to log in
- THEN the system MUST deny access with `reason = "invalid_credentials"`, matching today's generic `INVALID_LOGIN_MESSAGE`

#### Scenario: existing caller ignoring `reason` is unaffected

- GIVEN an existing call site (any nodo) that only reads the boolean/`ok` result and never reads `reason`
- WHEN it runs against `activo`, `pausado`, or `sin_acceso` units after this change ships
- THEN its observed pass/fail behavior MUST be identical to before this change

## ADDED Requirements

### Requirement: Single Source of Truth for user_has_node_access

`nodo-landing/supabase/migrations` MUST be the only permitted location that defines or replaces
`public.user_has_node_access`. No other repo's migrations (`nodo-inmo`, `nodo-clinica`, etc.) MUST
redefine this function. CI MUST fail any PR that introduces a migration file outside
`nodo-landing/supabase/migrations` containing a `user_has_node_access` function definition.

#### Scenario: Redefinition outside nodo-landing is blocked

- GIVEN a PR adds a migration under `nodo-inmo/supabase/migrations` that runs
  `create or replace function public.user_has_node_access(...)`
  (as happened in `20260622120001_local_inmo_node_access_rpc.sql`, which broke Autos/Finanzas
  login until `20260623000002_restore_user_has_node_access.sql` restored it)
- WHEN CI runs the RPC-drift guard
- THEN the check MUST fail and block the merge

#### Scenario: Legitimate change lands only in nodo-landing

- GIVEN a PR modifies `user_has_node_access` only via a new migration under
  `nodo-landing/supabase/migrations`
- WHEN CI runs the RPC-drift guard
- THEN the check MUST pass
