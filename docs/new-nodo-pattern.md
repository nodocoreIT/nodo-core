# New Nodo Integration Pattern

This document describes the pattern established across nodo-inmo, nodo-autos, and nodo-finanzas
for role-based access, invitation flows, and the shared admin shell. Use it as a checklist when
onboarding a new nodo into the multi-nodo system.

---

## Shared Database Tables

All nodos share three tables in the `shared` schema:

| Table | Purpose |
|---|---|
| `shared.organizations` | One row per nodo tenant (`product` column identifies the nodo) |
| `shared.org_members` | One row per user per org, with a `role` column that becomes a JWT claim |
| `shared.org_invitations` | Pending invitations; consumed by the `accept-invitation` Edge Function |

### organizations

```sql
id          uuid PRIMARY KEY
name        text
product     text   -- e.g. 'nodo-autos', 'nodo-finanzas', 'inmo'
external_id text   -- optional: link to the nodo's own tenant table (e.g. nodo_autos.clientes.id)
```

### org_members

```sql
org_id  uuid REFERENCES shared.organizations(id)
user_id uuid REFERENCES auth.users(id)
role    text CHECK (role IN ('admin','agent','owner','tenant','super_admin','seller','guest','member'))
-- composite PK: (org_id, user_id)
```

Adding a new role value requires an `ALTER TABLE shared.org_members DROP CONSTRAINT org_members_role_check`
followed by a new `ADD CONSTRAINT` that extends the `IN (...)` list.
Migration 012 on nodo-autos shows the exact pattern.

### JWT flow

Supabase's Custom Access Token Hook reads `shared.org_members` after login and injects
`{ org_id, role }` into the JWT claims. The shared `AuthProvider` from
`@nodocore/shared-components` surfaces these claims as `useAuth().role` and `useAuth().user`.
No DB query is needed in the frontend to determine a user's role.

---

## Role System

### Role values

| DB role | Typical use |
|---|---|
| `super_admin` | Cross-tenant admin; bypasses all RLS tenant isolation |
| `admin` | Org admin (inmo, autos) |
| `agent` | nodo-inmo employee |
| `seller` | nodo-autos employee |
| `guest` | nodo-autos limited access |
| `member` | nodo-finanzas standard user |
| `owner` / `tenant` | nodo-inmo property roles |

The **org owner** (the client who pays for the nodo) should be assigned `super_admin`.
This grants cross-tenant visibility and bypasses RLS on all tables that implement the
super_admin bypass pattern (see RLS section below).

### Role display mapping

`nodo-inmo/supabase/functions/_shared/org-member-roles.ts` holds two lookup tables used
by every Edge Function:

```typescript
// Display label → DB role (used when inviting a member)
export const DISPLAY_TO_DB_ROLE: Record<string, string> = {
  Administrador: "admin",
  Empleado: "agent",
  Invitado: "guest",
  Miembro: "member",
  // Identity pass-through so callers can pass DB roles directly
  seller: "seller",
  guest: "guest",
  member: "member",
  // ...
};

// DB role → Display label (used when listing members)
export const DB_TO_DISPLAY_ROLE: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  seller: "Vendedor",
  guest: "Invitado",
  member: "Miembro",
  // ...
};
```

When adding a new nodo with new role names, add entries to **both** maps.

**Important:** When calling `invite-member` from a new nodo's `useXxxStaff` hook, prefer
passing the DB role directly (e.g. `"seller"`) rather than the display label. The identity
mappings in `DISPLAY_TO_DB_ROLE` ensure the `?? "agent"` fallback is not triggered
for valid DB role values.

---

## Edge Functions

All invitation and member-management operations reuse the four shared Edge Functions deployed
under `nodo-inmo/supabase/functions/`:

| EF | Purpose |
|---|---|
| `invite-member` | Creates an invitation record; sends magic-link email |
| `accept-invitation` | Converts a pending invitation into an `org_members` row |
| `list-org-members` | Lists all members of the caller's org |
| `update-org-member-role` | Changes a member's role |
| `remove-org-member` | Removes a member from the org |

### The `products` parameter

Every EF accepts an optional `products?: string[]` body parameter. This is the list of
`shared.organizations.product` values that identify the nodo. When absent, it defaults
to `["inmo", "nodo-inmo"]` for backward compatibility with nodo-inmo.

```typescript
// invite-member body
{
  name: string;
  email: string;
  role: string;          // DB role value (e.g. "seller") or display label
  redirectTo: string;    // full URL to the nodo's landing page
  inviterName?: string;
  nodeLabel?: string;    // shown in the email (e.g. "NODO | Autos")
  products?: string[];   // e.g. ["nodo-autos"]
}
```

The same `products` field is accepted by `list-org-members`, `update-org-member-role`,
and `remove-org-member`.

### How org resolution works

```typescript
// _shared/inmo-admin.ts
export async function resolveAdminOrgId(
  sql: postgres.Sql,
  userId: string,
  products: string[],
): Promise<string | null> {
  // Returns org_id where the caller is admin or super_admin
  // for any of the given products.
}
```

If the caller's JWT does not map to an `org_members` row with `role IN ('admin','super_admin')`
for the given products, the EF returns `403 Forbidden`.

---

## AuthProvider Setup

Wrap the nodo's root with `SupabaseProvider` + `AuthProvider` from `@nodocore/shared-components`:

```tsx
// src/app/providers.tsx
import { SupabaseProvider, AuthProvider } from "@nodocore/shared-components";

const AUTH_CONFIG = {
  allowedRoles: ["super_admin", "admin", "seller", "guest"],  // adjust per nodo
  unitCode: "Autos",   // matches the nodeLabel used in enforceNodeAccess
  roleDestinations: {
    super_admin: "/admin/dashboard",
    admin: "/admin/dashboard",
    seller: "/admin/dashboard",
    guest: "/admin/dashboard",
  },
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseProvider>
      <AuthProvider config={AUTH_CONFIG}>
        {children}
      </AuthProvider>
    </SupabaseProvider>
  );
}
```

**`unitCode`** must match the string passed to `enforceNodeAccess(supabase, "Autos")` in
the auth callback. It is used to identify this nodo's access gate.

**`allowedRoles`** should include every role that is permitted to enter the panel.
Roles not in this list are bounced back to the landing login.

Consumers import `useAuth` from `@nodocore/shared-components` (not a local hook):

```typescript
import { useAuth } from "@nodocore/shared-components";
const { session, role, user, isLoading, signOut } = useAuth();
```

Note: the shared hook returns `isLoading` (not `loading`). When migrating a nodo that had
a local `use-auth` hook returning `loading`, use a destructure alias:
`const { isLoading: loading } = useAuth()`.

---

## Auth Callback

The auth callback page handles session hydration, invitation acceptance, and optional forced
password reset. The sequence is fixed — do not reorder these steps:

```typescript
// src/features/auth/callback/auth-callback-page.tsx
const settle = async () => {
  // 1. Hydrate session from URL hash tokens (magic-link / invite flow)
  if (access_token && refresh_token) {
    await supabase.auth.setSession({ access_token, refresh_token });
    await supabase.auth.refreshSession();
  } else {
    await supabase.auth.getSession();
  }

  // 2. Accept any pending invitations BEFORE enforcing access
  await acceptPendingInvitations(supabase);

  // 3. Forced password reset for invite/recovery links
  const mustReset =
    type === "invite" ||
    type === "recovery" ||
    (await fetchMustSetPassword(supabase));
  if (mustReset) { /* show RequiredPasswordForm */ return; }

  // 4. Enforce nodo access (bounces back to landing login if role not allowed)
  const access = await enforceNodeAccess(supabase, "Autos");
  if (!access.ok) { /* show error / redirect to login */ return; }

  navigate("/", { replace: true });
};
```

`acceptPendingInvitations` calls `get_my_pending_invitations` RPC and then invokes the
`accept-invitation` EF for each token. It must run **before** `enforceNodeAccess` so the
`org_members` row exists when the access check reads the JWT claims.

Copy `accept-pending-invitations.ts` from either nodo-autos or nodo-finanzas — it is
identical across nodos:

```typescript
// src/shared/lib/accept-pending-invitations.ts
export async function acceptPendingInvitations(supabase: SupabaseClient) {
  const { data: invitations } = await supabase.rpc("get_my_pending_invitations");
  if (!invitations?.length) return;
  for (const inv of invitations as { token: string }[]) {
    await supabase.functions.invoke("accept-invitation", {
      body: { token: inv.token, action: "accept" },
    });
  }
}
```

---

## RequireAuth Guard

Replace any DB-query-based auth guard with a JWT role check:

```tsx
// src/shared/components/require-auth/require-auth.tsx
import { useAuth } from "@nodocore/shared-components";

const ALLOWED_ROLES = new Set(["super_admin", "admin", "seller", "guest"]);

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, role, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!session || !role || !ALLOWED_ROLES.has(role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

No async DB fetch, no `useEffect` — a single render against the in-memory JWT claim.

---

## SettingsModuleProvider

Wrap the admin layout (or app root) with a nodo-specific `XxxSettingsModuleProvider` that
configures the shared `SettingsDialog`:

```tsx
// src/shared/lib/xxx-settings-module.tsx
import { SettingsModuleProvider, type SettingsModuleContextValue } from "@nodocore/nodo-modules/settings";

export function XxxSettingsModuleProvider({ children }: { children: React.ReactNode }) {
  const staff = useXxxStaff();
  // ...other hooks (profile, theme, AI settings, bank accounts)

  const value = useMemo((): SettingsModuleContextValue => ({
    adminRole: "admin",              // DB role that counts as admin in the settings UI
    superAdminRole: "super_admin",   // optional; shown as "Super Admin" in role selector
    adminDisplayRole: "Administrador",
    defaultInviteRole: "guest",      // pre-selected role when opening the invite dialog
    roleOptions: [
      { value: "seller", label: "Vendedor" },
      { value: "guest",  label: "Invitado" },
    ],
    hiddenTabs: [],   // e.g. ["company"] if the nodo has no org profile
    managedNav: XXX_MANAGED_NAV,
    inviteMessages: {
      invited: "Invitación enviada por correo.",
      existing: "Usuario agregado a este nodo.",
    },
    staff: {
      users: staff.users,
      loading: staff.loading,
      error: staff.error,
      fetchMembers: staff.fetchMembers,
      inviteUser: staff.inviteUser,
      updateMemberRole: staff.updateMemberRole,
      removeMember: staff.removeMember,
    },
    // profile / logo / AI / theme / bankAccounts — include as needed
  }), [/* deps */]);

  return <SettingsModuleProvider value={value}>{children}</SettingsModuleProvider>;
}
```

### Per-nodo configuration reference

| Field | nodo-inmo | nodo-autos | nodo-finanzas |
|---|---|---|---|
| `adminRole` | `"admin"` | `"admin"` | `"super_admin"` |
| `superAdminRole` | `"super_admin"` | — | `"super_admin"` |
| `defaultInviteRole` | `"agent"` | `"guest"` | `"member"` |
| `roleOptions` | agent, owner, tenant | seller, guest | member |
| `hiddenTabs` | none | `["ipc"]` | `["company"]` |
| Has org profile | yes | yes | no (no-op implementations) |

When a nodo has no org profile table, provide no-op stubs and hide the `"company"` tab:

```typescript
profile: null,
profileLoading: false,
upsertProfile: async () => {},
isUpsertingProfile: false,
uploadLogo: async () => "",
isUploadingLogo: false,
logoSignedUrl: null,
pdfLogoSignedUrl: null,
hiddenTabs: ["company"],
```

### Vite alias required

If the nodo's `vite.config.ts` does not already resolve `@nodocore/nodo-modules/settings`,
add the alias:

```typescript
"@nodocore/nodo-modules/settings": path.resolve(
  __dirname,
  "../../packages/nodo-modules/src/settings/index.ts",
),
```

---

## NodoSwitcher

Add `NodoSwitcher` from `@nodocore/nodo-modules` to the admin layout header. It must appear
in both the mobile and desktop header slots:

```tsx
import { NodoSwitcher } from "@nodocore/nodo-modules";
import {
  PortalHeaderActions,
  PortalHeaderMobileActions,
} from "@nodocore/shared-components";

// In the header JSX:
<PortalHeaderMobileActions
  notifications={<NotificationsBell />}
  trailing={<NodoSwitcher />}
/>

<PortalHeaderActions
  notifications={<NotificationsBell />}
  trailing={<NodoSwitcher />}
/>
```

No configuration is needed — `NodoSwitcher` reads the authenticated user's org membership
list and renders a dropdown to switch between nodos the user belongs to.

---

## Staff Hook (useXxxStaff)

Each nodo needs a staff hook that calls the shared EFs with the nodo's `products` value.
Mirror the pattern from `nodo-autos/src/shared/hooks/use-autos-staff.ts`:

```typescript
// src/shared/hooks/use-xxx-staff.ts
const PRODUCTS = ["nodo-xxx"];

export function useXxxStaff() {
  // Zustand store or local state for users / loading / error

  async function fetchMembers() {
    const { data } = await invokeFunction("list-org-members", { products: PRODUCTS });
    // update store
  }

  async function inviteUser(params: InviteParams) {
    await invokeFunction("invite-member", {
      ...params,
      products: PRODUCTS,
      nodeLabel: "NODO | Xxx",
    });
  }

  async function updateMemberRole(userId: string, role: string) {
    await invokeFunction("update-org-member-role", { userId, role, products: PRODUCTS });
  }

  async function removeMember(userId: string) {
    await invokeFunction("remove-org-member", { userId, products: PRODUCTS });
  }

  return { users, loading, error, fetchMembers, inviteUser, updateMemberRole, removeMember };
}
```

Pass the DB role directly when inviting (e.g. `"seller"`, not `"Vendedor"`). The identity
mappings in `DISPLAY_TO_DB_ROLE` handle pass-through, but passing the DB value directly
is more explicit and avoids relying on the mapping table.

---

## Staff Nav Config

Create a `xxx-staff-nav.ts` file that exports the role options used by the settings UI and
any nav-filtering helpers:

```typescript
// src/shared/lib/xxx-staff-nav.ts
export type XxxAccessRole = "super_admin" | "admin" | "seller" | "guest";

export const XXX_STAFF_ROLE_OPTIONS = [
  { value: "seller", label: "Vendedor" },
  { value: "guest",  label: "Invitado" },
];

export const XXX_ADMIN_DISPLAY_ROLE = "Administrador";
export const XXX_EMPLOYEE_DISPLAY_ROLE = "Vendedor";

// Roles that always have full panel access (no nav filtering needed)
export const XXX_FIXED_ACCESS_ROLES: XxxAccessRole[] = ["super_admin", "admin"];
```

---

## RLS Policies

### Tenant isolation (existing pattern)

If the nodo uses `cliente_id` or `org_id` for row-level tenant isolation, add a
`super_admin` bypass to every policy without rewriting the underlying isolation model.

Use the SECURITY DEFINER helper pattern from `nodo-autos/supabase/migrations/013_rls_super_admin.sql`:

```sql
-- Create reusable helpers (one-time setup per nodo schema)
CREATE OR REPLACE FUNCTION nodo_xxx.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = nodo_xxx, shared, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM shared.org_members
    WHERE user_id = (SELECT auth.uid()) AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION nodo_xxx.is_xxx_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = nodo_xxx, shared, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM shared.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin')
  )
$$;

REVOKE ALL ON FUNCTION nodo_xxx.is_super_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION nodo_xxx.is_super_admin() TO authenticated, service_role;
```

Then extend each tenant-isolation policy with an OR clause:

```sql
-- Before (tenant isolation only)
CREATE POLICY "tenant_isolation" ON nodo_xxx.some_table
  FOR ALL USING (cliente_id = get_my_cliente_id());

-- After (tenant isolation + super_admin bypass)
CREATE POLICY "tenant_isolation" ON nodo_xxx.some_table
  FOR ALL USING (
    cliente_id = get_my_cliente_id()
    OR (SELECT nodo_xxx.is_super_admin())
  );

-- Admin-only policies: replace legacy role check with shared.org_members lookup
CREATE POLICY "admin_only" ON nodo_xxx.audit_logs
  FOR ALL USING ((SELECT nodo_xxx.is_xxx_admin()));
```

### JWT claims in policies (new nodos)

For new nodos without a legacy `cliente_id` isolation model, read `org_id` from the JWT
claims directly:

```sql
USING (
  org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  OR (SELECT nodo_xxx.is_super_admin())
)
```

---

## DB Migration (for nodos with existing users)

If the nodo has an existing user table that needs to be migrated into `shared.org_members`,
follow the pattern in `nodo-autos/supabase/migrations/012_jwt_role_migration.sql`:

1. **Extend the role constraint** to include the new nodo's roles.
2. **Add `external_id` to `shared.organizations`** (if not present) to link orgs to the
   nodo's own tenant table.
3. **Backfill `shared.org_members`** by iterating the existing user table, resolving or
   creating an org row, mapping the legacy role, and inserting with `ON CONFLICT DO NOTHING`.
4. **Keep the existing user table** — it likely holds non-auth data (profile photos, phone
   numbers, etc.) that JWT roles do not replace.
5. **Provide a DOWN migration** (as comments or runnable SQL) that deletes the inserted rows
   and restores the original constraint.

---

## Guest Dashboard (optional)

If the nodo has a role with limited access (e.g. `guest` in nodo-autos), create a guest
dashboard component and conditionally render it instead of the main panel content:

```tsx
// src/features/dashboard/dashboard-page.tsx
export function DashboardPage() {
  const { role } = useAuth();

  // Guard loadInitialData BEFORE early return (hooks must be called unconditionally)
  useEffect(() => {
    if (role !== "guest") void loadInitialData();
  }, [role]);

  if (role === "guest") return <GuestDashboard />;

  return <MainDashboardContent />;
}
```

The `useEffect` guard is required because React prohibits early returns before hooks.

---

## New Nodo Integration Checklist

Use this list when onboarding a brand-new nodo. Complete steps in order — each step builds
on the previous.

**1. Database**
- [ ] Verify or create a row in `shared.organizations` with the correct `product` value (e.g. `"nodo-xxx"`)
- [ ] Extend `shared.org_members` role constraint to include any new role values
- [ ] If migrating existing users: write and test the backfill migration; include a DOWN migration

**2. RLS policies**
- [ ] Create `nodo_xxx.is_super_admin()` and `nodo_xxx.is_xxx_admin()` SECURITY DEFINER helpers
- [ ] Add `OR (SELECT nodo_xxx.is_super_admin())` to all tenant-isolation policies
- [ ] Update admin-only policies to use `is_xxx_admin()` instead of legacy role column checks

**3. Role mapping**
- [ ] Add new display labels and DB roles to `DISPLAY_TO_DB_ROLE` in `org-member-roles.ts`
- [ ] Add reverse entries to `DB_TO_DISPLAY_ROLE`
- [ ] Create `xxx-staff-nav.ts` with role options, admin display role, and access role type

**4. AuthProvider**
- [ ] Wrap the nodo root with `SupabaseProvider` + `AuthProvider` (config: `allowedRoles`, `unitCode`, `roleDestinations`)
- [ ] Remove any local `use-auth` hook; update all consumers to import from `@nodocore/shared-components`
- [ ] Note the `isLoading` vs `loading` difference when migrating existing consumers

**5. Auth callback**
- [ ] Copy `accept-pending-invitations.ts` into `src/shared/lib/`
- [ ] Rewrite (or create) `auth-callback-page.tsx` with the fixed sequence: setSession → acceptPendingInvitations → mustReset check → enforceNodeAccess → navigate
- [ ] Pass the correct `unitCode` string to `enforceNodeAccess`

**6. RequireAuth guard**
- [ ] Replace any DB-query-based auth guard with a `useAuth().role` check against an `allowedRoles` Set

**7. Staff hook**
- [ ] Create `use-xxx-staff.ts` that calls all five EFs with `products: ["nodo-xxx"]`
- [ ] Pass DB roles directly (not display labels) when calling `invite-member`

**8. SettingsModuleProvider**
- [ ] Create `xxx-settings-module.tsx` with `adminRole`, `defaultInviteRole`, `roleOptions`, `hiddenTabs`
- [ ] Provide no-op profile/logo stubs and set `hiddenTabs: ["company"]` if the nodo has no org profile
- [ ] Wrap the admin layout (or app root) with the provider
- [ ] Add `@nodocore/nodo-modules/settings` alias to `vite.config.ts` if missing

**9. Admin layout**
- [ ] Import and render `<NodoSwitcher />` in both `PortalHeaderMobileActions.trailing` and `PortalHeaderActions.trailing`
- [ ] Add `<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />` at the layout root
- [ ] Add a settings gear button in the sidebar; conditionally show it based on role (e.g. only `super_admin` or `admin`)

**10. Guest dashboard (if applicable)**
- [ ] Create `guest-dashboard.tsx` with a welcome/placeholder screen
- [ ] Conditionally render it from the main dashboard when `role === "guest"`
- [ ] Guard `loadInitialData` inside `useEffect` instead of using an early return

**11. Tests**
- [ ] Unit: `require-auth` — one test per allowed role + unauthenticated redirect
- [ ] Unit: `xxx-settings-module` — verify `adminRole`, `defaultInviteRole`, `roleOptions` contents
- [ ] Unit: staff hook — verify all EF calls include `products: ["nodo-xxx"]`; verify `inviteUser` passes DB role not display label
