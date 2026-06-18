# Unified Cross-Node Registration Flow

Architecture for registration across Inmo, Salud/Clínica, Autos, and Finanzas with admin enablement in Core Dashboard.

## State machine (`client_units.status`)

```
Signup → email verify → pending_review
Admin enables (+ docs verified) → pending_onboarding + activation email
User completes onboarding → activo (provisioned) | onboarding
Admin suspends → pausado
```

Self-service exception: `paciente` plan skips admin review → `activo` immediately after email verify.

## Node-scoped access

Table `nodo_core.node_email_access` enforces **one registration per (email, unit_code)**.

- `juan@gmail.com` + `Inmo` → access only to Inmo when provisioned
- Same email can register `Autos` separately → separate `client_unit` + separate provision in Autos Supabase
- No cross-node access unless each unit is enabled and provisioned

## Flow

### 1. Signup (any node login page)

Call `submitNodeRegistration({ unitCode, fullName, email, phone?, plan, origin })`.

- Inserts `pending_registrations` (password optional for business nodes)
- Sends verification email

### 2. Email verification (`GET /api/verify-registration?token=`)

- Creates `clients` + `client_units` + `node_email_access`
- Business nodes: `status = pending_review`, notifies admin email + `/panel/solicitudes`
- Paciente: `status = activo`, creates auth user immediately

### 3. Admin review (`/panel/solicitudes`)

- Review ID / payment documentation (notes field; optional `registration_verification_docs` + storage bucket)
- **Habilitar** → `POST /api/admin/enable-registration` → activation token + email to `/onboarding?token=`

### 4. Onboarding (`/onboarding`)

User completes: name, address, phone, plan (starter/pro/demo), email, password.

`POST /api/onboarding/complete` → updates profile, provisions target nodo, sets `activo`.

### 5. Provisioning

`lib/registration/provision.ts` + `/api/nodo-provision`:

| Node | Tenant model |
|------|----------------|
| Inmo, Clínica | `shared.organizations` + `org_members` |
| Autos | `nodo_autos.clientes` + `users` |
| Finanzas | Auth user only (RLS per-user pending) |

Env vars per nodo: `NODO_<CODE>_SUPABASE_URL`, `NODO_<CODE>_SERVICE_ROLE_KEY`.

## Database migration

Run `nodo-landing/supabase/migrations/20260618000000_unified_registration_flow.sql` in the landing Supabase project (`nodo_core` schema).

## Wiring login pages

Replace per-node registration actions with:

```ts
import { submitNodeRegistration } from "@/app/actions/registration";

await submitNodeRegistration({
  unitCode: "Inmo", // or Salud, Autos, Finanzas
  fullName,
  email,
  phone,
  plan: "inmo",
  origin: window.location.origin,
});
```
