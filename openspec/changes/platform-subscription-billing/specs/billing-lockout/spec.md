# Billing Lockout Specification

## Purpose

A shared, `reason`-aware access gate (Netflix/Slack pattern) that, when a `client_unit` is
`impago`, keeps the user's session alive but restricts every route except
"Configuración → Suscripción". Whitelisting logic lives centrally in `packages/shared-components`;
the Suscripción screen itself is implemented per nodo. Depends on `node-access` returning a
machine-readable `reason` (see `node-access` delta spec).

## Requirements

### Requirement: Session Survives payment_overdue (No Forced Sign-Out)

When the access check returns `reason = "payment_overdue"`, the system MUST NOT sign the user out
and MUST NOT deny the session — this is distinct from `banned`/`invalid_credentials`, which MUST
continue to force sign-out exactly as today.

#### Scenario: impago login keeps the session

- GIVEN a `client_unit` with status `impago`
- WHEN a registered user logs in to that nodo
- THEN the session MUST be established and the gate MUST report `reason = "payment_overdue"`

#### Scenario: banned/invalid credentials still deny access

- GIVEN a user who is auth-banned or has no matching access row
- WHEN they attempt to log in
- THEN the system MUST sign them out locally, exactly as before this change

### Requirement: Central Whitelisted-Route Enforcement

The shared gate MUST accept a per-nodo Suscripción route path and MUST block navigation to any
other route (client-side) while `reason = "payment_overdue"` is active for the session, redirecting
to the whitelisted route.

#### Scenario: Blocked route redirects to Suscripción

- GIVEN an active session with `reason = "payment_overdue"`
- WHEN the user navigates to any route other than the configured Suscripción route
- THEN the gate MUST redirect to the Suscripción route

#### Scenario: Suscripción route itself is allowed

- GIVEN an active session with `reason = "payment_overdue"`
- WHEN the user navigates to the configured Suscripción route
- THEN navigation MUST be allowed

### Requirement: Server-Side (API) Enforcement, Not Just UI Navigation

The same restriction MUST be enforced on the server for API routes, not only via client-side
navigation guards, so that direct API calls cannot bypass the lockout.

#### Scenario: Direct API call while impago

- GIVEN an active session with `reason = "payment_overdue"`
- WHEN a request hits any API route other than the whitelisted Suscripción-related endpoints
- THEN the server MUST reject the request instead of relying solely on client-side redirection

### Requirement: Missing Suscripción Screen Fails Safe

If a nodo has not yet implemented its own Suscripción screen, the lockout MUST still block all
other routes (fail closed) rather than granting full access by default.

#### Scenario: Nodo without a Suscripción screen yet

- GIVEN a nodo that has not built its Suscripción UI
- WHEN a user with `reason = "payment_overdue"` logs in
- THEN the gate MUST still block non-whitelisted routes and MUST show a minimal generic notice instead of full access

### Requirement: Lockout Lifts on Next Access Check After Reactivation

Once the unit's status returns to `activo` (successful payment), the next access-check
(e.g., next navigation or session revalidation) MUST report no `reason` and MUST restore full
access without requiring the user to log out and back in.

#### Scenario: Reactivation without re-login

- GIVEN a session that was restricted with `reason = "payment_overdue"`
- WHEN the underlying `client_unit` becomes `activo` and the gate re-validates
- THEN the restriction MUST be lifted on that same session
