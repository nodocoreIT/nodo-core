# nodocore — Agent guide

Monorepo of **nodo** apps (Vite + React 19 SPAs) proxied by `nodo-landing`, plus shared packages.

## Shared packages

| Package | Purpose |
|---------|---------|
| `@nodocore/shared-components` | Auth, UI, Supabase client factory, portal header |
| `@nodocore/nodo-modules` | Optional cross-nodo modules: **agenda**, **caja**, **notifications** |

---

## Installing Agenda + Caja in a nodo

Use `@nodocore/nodo-modules` when a nodo needs agenda/tareas, caja, or the notification bell. **Agenda and caja share the same UX as nodo-inmo** — each nodo only configures categories, link fields, tenant column, and formatters via thin wrappers.

### Module exports

```ts
// Agenda
import {
  AgendaModuleProvider,
  AgendaPage,
  createTasksHooks,
  type AgendaCategory,
  type AgendaModuleContextValue,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@nodocore/nodo-modules/agenda";

// Caja
import {
  CajaModuleProvider,
  CajaPage,
  createCajaHooks,
  createConceptosHooks,
  createCashAccountsHooks,
  type CajaModuleContextValue,
  type CreateCashMovementInput,
  type UpdateCashMovementInput,
} from "@nodocore/nodo-modules/caja";

// Notifications (optional bell)
import {
  NotificationsDropdown,
  buildTaskNotifications,
  type AppNotification,
} from "@nodocore/nodo-modules/notifications";
```

### Step 1 — Dependency

```json
// nodo-<name>/package.json
"dependencies": {
  "@nodocore/nodo-modules": "workspace:*",
  "@nodocore/shared-components": "workspace:*"
}
```

Run `pnpm install` at monorepo root.

### Step 2 — Vite aliases + TypeScript paths

Compile from **source** (not `dist`) so React hooks stay shared. **Subpath aliases must come before the package root alias** — otherwise `/agenda` resolves inside `index.ts` and Vite returns 500.

```ts
// nodo-<name>/vite.config.ts
const monorepoRoot = resolve(__dirname, "..");

resolve: {
  dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "zustand", "@tanstack/react-query"],
  alias: {
    "@": resolve(__dirname, "./src"),
    "@nodocore/shared-components/styles": resolve(monorepoRoot, "packages/shared-components/src/styles"),
  // Subpaths BEFORE package root
    "@nodocore/nodo-modules/agenda": resolve(monorepoRoot, "packages/nodo-modules/src/agenda/index.ts"),
    "@nodocore/nodo-modules/caja": resolve(monorepoRoot, "packages/nodo-modules/src/caja/index.ts"),
    "@nodocore/nodo-modules/notifications": resolve(monorepoRoot, "packages/nodo-modules/src/notifications/index.ts"),
    "@nodocore/nodo-modules": resolve(monorepoRoot, "packages/nodo-modules/src/index.ts"),
    "@nodocore/shared-components": resolve(monorepoRoot, "packages/shared-components/src/index.ts"),
  },
},
optimizeDeps: {
  include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "sonner"],
  exclude: ["@nodocore/shared-components", "@nodocore/nodo-modules", "zustand"],
},
```

```json
// nodo-<name>/tsconfig.app.json — paths mirror Vite aliases
"paths": {
  "@/*": ["./src/*"],
  "@nodocore/nodo-modules": ["../packages/nodo-modules/src/index.ts"],
  "@nodocore/nodo-modules/agenda": ["../packages/nodo-modules/src/agenda/index.ts"],
  "@nodocore/nodo-modules/caja": ["../packages/nodo-modules/src/caja/index.ts"],
  "@nodocore/nodo-modules/notifications": ["../packages/nodo-modules/src/notifications/index.ts"]
}
```

### Step 3 — Database migration

Tenant-scoped tables with RLS. Reference: `nodo-autos/supabase/migrations/009_nodo_autos_schema_align.sql` (`nodo_autos` schema).

| Table | Module | Notes |
|-------|--------|-------|
| `tasks` | Agenda | FKs optional per nodo (`vehicle_id`, `property_id`, `contact_id`, …) |
| `cash_movements` | Caja | `type`, `amount`, `currency`, `date`, `concept`, `category`, `source` |
| `conceptos` | Caja (recommended) | Creatable concept list per tenant |
| `cash_accounts` | Caja (recommended) | Account labels for movement form + filters |

**Schema convention (same as nodo-inmo):** each nodo uses its own Postgres schema — `nodo_inmo`, `nodo_autos`, etc. App code calls `supabase.schema("<schema>").from("table")` (in autos: `autosDb().from(...)`). Tenant column: `cliente_id` (autos) or `org_id` (inmo). Pass `schema` to hook factories.

### Step 4 — Hooks factory (`src/shared/lib/<nodo>-module-hooks.ts`)

Resolve tenant ID from store or auth **outside React** (e.g. Zustand `getState()`) or via a factory that receives `getTenantId` at runtime.

```ts
import { createTasksHooks } from "@nodocore/nodo-modules/agenda";
import {
  createCajaHooks,
  createConceptosHooks,
  createCashAccountsHooks,
} from "@nodocore/nodo-modules/caja";
import { supabase } from "@/shared/lib/supabase";

function getTenantId() {
  return useMyStore.getState().currentTenant?.id; // or orgId from auth in wrapper
}

export const myTasksHooks = createTasksHooks({
  queryKey: ["nodo-<name>", "tasks"],
  table: "tasks",
  tenantColumn: "cliente_id", // or "org_id"
  getTenantId,
  supabase,
  schema: undefined, // or "nodo_inmo"
});

export const myCajaHooks = createCajaHooks({
  queryKey: ["nodo-<name>", "cash-movements"],
  table: "cash_movements",
  tenantColumn: "cliente_id",
  getTenantId,
  supabase,
});

export const myConceptosHooks = createConceptosHooks({
  queryKey: ["nodo-<name>", "conceptos"],
  table: "conceptos",
  tenantColumn: "cliente_id",
  getTenantId,
  supabase,
});

export const myCashAccountsHooks = createCashAccountsHooks({
  queryKey: ["nodo-<name>", "cash-accounts"],
  table: "cash_accounts",
  tenantColumn: "cliente_id",
  getTenantId,
  supabase,
});
```

**Inmo pattern** (tenant from `useAuth` inside component):

```ts
import { createInmoTasksHooks } from "@/shared/lib/inmo-module-hooks";

// inmo-module-hooks.ts exports:
export function createInmoTasksHooks(getOrgId: () => string | null | undefined) {
  return createTasksHooks({
    queryKey: ["nodo_inmo", "tasks"],
    table: "tasks",
    tenantColumn: "org_id",
    getTenantId: getOrgId,
    supabase,
    schema: "nodo_inmo",
  });
}

// In agenda wrapper:
const { orgId } = useAuth();
const tasksHooks = useMemo(() => createInmoTasksHooks(() => orgId), [orgId]);
```

### Step 5 — Agenda config (`src/features/agenda/agenda-config.ts`)

Define categories with icons (same shape as nodo-inmo). Export a label map for notifications.

```ts
import { MapPin, CheckCircle2, /* … */ } from "lucide-react";
import type { AgendaCategory } from "@nodocore/nodo-modules/agenda";

export const MY_TASK_CATEGORIES: AgendaCategory[] = [
  { value: "general", label: "General", icon: CheckCircle2, bg: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "visita", label: "Visita/Muestra", icon: MapPin, bg: "bg-orange-50 text-orange-700 border-orange-200" },
  // … domain-specific categories
];

export const MY_CATEGORY_LABELS = Object.fromEntries(
  MY_TASK_CATEGORIES.map((c) => [c.value, c.label]),
);
```

Ensure DB `tasks.category` check constraint includes these values.

### Step 6 — Agenda page wrapper (`src/features/agenda/agenda-page.tsx`)

Thin wrapper: load link-field options, wire hooks, provide `AgendaModuleProvider`, render shared `<AgendaPage />`.

```tsx
import { useMemo } from "react";
import {
  AgendaModuleProvider,
  AgendaPage,
  type AgendaModuleContextValue,
} from "@nodocore/nodo-modules/agenda";
import { myTasksHooks } from "@/shared/lib/<nodo>-module-hooks";
import { MY_TASK_CATEGORIES } from "./agenda-config";

export function MyAgendaPage() {
  const { data: tasks = [], isLoading } = myTasksHooks.useTasks();
  const createMutation = myTasksHooks.useCreateTask();
  const updateMutation = myTasksHooks.useUpdateTask();
  const deleteMutation = myTasksHooks.useDeleteTask();

  const moduleValue = useMemo((): AgendaModuleContextValue => ({
    categories: MY_TASK_CATEGORIES,
    assigneeOptions: staff.map((u) => ({ value: u.name, label: u.name })),
    linkFields: [
      {
        field: "property_id",       // must match tasks table column
        label: "Propiedad vinculada",
        cardPrefix: "Propiedad",
        options: properties.map((p) => ({ value: p.id, label: p.address })),
        emptyLabel: "Ninguna",
        searchPlaceholder: "Buscar propiedad…",
      },
      // add more link fields per nodo (vehicle_id, customer_id, …)
    ],
    agendaBasePath: "/admin/agenda",
    entityLabel: "la Agencia",
    tasks,
    isLoading,
    createTask: (input) => createMutation.mutateAsync(input),
    updateTask: (input) => updateMutation.mutateAsync(input),
    deleteTask: (id) => deleteMutation.mutateAsync(id).then(() => undefined),
    isSaving: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  }), [tasks, isLoading, /* … */]);

  return (
    <AgendaModuleProvider value={moduleValue}>
      <AgendaPage />
    </AgendaModuleProvider>
  );
}
```

### Step 7 — Caja page wrapper (`src/features/caja/caja-page.tsx`)

Same pattern: movements from hooks, formatters local, conceptos/cuentas from DB.

```tsx
import { useMemo } from "react";
import {
  CajaModuleProvider,
  CajaPage,
  type CajaModuleContextValue,
} from "@nodocore/nodo-modules/caja";
import {
  myCajaHooks,
  myConceptosHooks,
  myCashAccountsHooks,
} from "@/shared/lib/<nodo>-module-hooks";

function formatMoney(amount: number, currency: "ARS" | "USD") { /* … */ }
function formatDate(date: string) { /* dd/mm/yyyy */ }

export function MyCajaPage() {
  const { data: movements = [], isLoading, isError } = myCajaHooks.useCashMovements();
  const createMutation = myCajaHooks.useCreateCashMovement();
  const updateMutation = myCajaHooks.useUpdateCashMovement();
  const deleteMutation = myCajaHooks.useDeleteCashMovement();
  const { data: conceptos = [] } = myConceptosHooks.useConceptos();
  const createConceptoMutation = myConceptosHooks.useCreateConcepto();
  const { data: cashAccounts = [] } = myCashAccountsHooks.useCashAccounts();

  const moduleValue = useMemo((): CajaModuleContextValue => ({
    movements,
    isLoading,
    isError,
    createMovement: (input) => createMutation.mutateAsync(input),
    updateMovement: (input) => updateMutation.mutateAsync(input),
    deleteMovement: (movement) => deleteMutation.mutateAsync(movement.id),
    isSaving: createMutation.isPending || updateMutation.isPending || createConceptoMutation.isPending,
    isDeleting: deleteMutation.isPending,
    formatMoney,
    formatDate,
    accountOptions: cashAccounts.map((a) => ({ value: a.label, label: a.label })),
    conceptOptions: [...new Set([...DEFAULT_CONCEPTS, ...conceptos.map((c) => c.name)])],
    sourceLabels: { manual: "Manual", commission: "Comisión", owner_payout: "Liquidación" },
    profitsHref: "/admin/ganancias",      // optional link text above table
    profitsLinkLabel: "Ganancias",
    emptyMessage: "Todavía no hay movimientos.",
    createConcepto: (name) => createConceptoMutation.mutateAsync(name).then(() => undefined),
  }), [movements, isLoading, isError, cashAccounts, conceptos, /* mutations */]);

  return (
    <CajaModuleProvider value={moduleValue}>
      <CajaPage />
    </CajaModuleProvider>
  );
}
```

Shared `CajaPage` includes: sortable table, filters (date, concept, origin, account, type), pagination, create/edit dialog, delete confirmation. **Rendiciones / settlement PDFs stay inmo-local** — not part of this module.

### Step 8 — Notification bell (optional)

```tsx
// src/features/notifications/use-notifications.ts
import { buildTaskNotifications } from "@nodocore/nodo-modules/notifications";
import { myTasksHooks } from "@/shared/lib/<nodo>-module-hooks";
import { MY_CATEGORY_LABELS } from "@/features/agenda/agenda-config";

export function useNotifications() {
  const { data: tasks = [] } = myTasksHooks.useTasks();
  const taskItems = buildTaskNotifications({
    tasks,
    agendaBasePath: "/admin/agenda",
    categoryLabels: MY_CATEGORY_LABELS,
  });
  // merge with nodo-specific signals (payments, stock alerts, …)
  return taskItems;
}

// src/features/notifications/notifications-bell.tsx
import { NotificationsDropdown } from "@nodocore/nodo-modules/notifications";
import { useNotifications } from "./use-notifications";

export function NotificationsBell() {
  const items = useNotifications();
  return <NotificationsDropdown items={items} kindStyles={MY_KIND_STYLES} />;
}
```

Wire in admin layout:

```tsx
import { PortalHeaderActions, PortalHeaderMobileActions } from "@nodocore/shared-components";
import { NotificationsBell } from "@/features/notifications/notifications-bell";

<PortalHeaderActions notifications={<NotificationsBell />} />
<PortalHeaderMobileActions notifications={<NotificationsBell />} />
```

### Step 9 — Admin routes + nav

```tsx
// portals/admin/admin-portal-page.tsx
<Route path="agenda" element={<MyAgendaPage />} />
<Route path="caja" element={<MyCajaPage />} />
```

```tsx
// portals/admin/components/admin-layout.tsx — NAV_ITEMS
{ to: "/admin/caja", label: "Caja", icon: Wallet },
{ to: "/admin/agenda", label: "Agenda y Tareas", icon: Calendar },

// ROUTE_TITLES
"/admin/caja": "Caja",
"/admin/agenda": "Agenda y Tareas",
```

### Checklist (copy when adding modules to a new nodo)

- [ ] `@nodocore/nodo-modules` in `package.json` + `pnpm install`
- [ ] Vite subpath aliases **before** package root + `optimizeDeps.exclude`
- [ ] `tsconfig.app.json` paths for agenda/caja/notifications
- [ ] Supabase migration: `tasks`, `cash_movements`, `conceptos`, `cash_accounts` + RLS
- [ ] `src/shared/lib/<nodo>-module-hooks.ts` with `createTasksHooks`, `createCajaHooks`, `createConceptosHooks`, `createCashAccountsHooks`
- [ ] `src/features/agenda/agenda-config.ts` — categories + label map
- [ ] `src/features/agenda/agenda-page.tsx` — `AgendaModuleProvider` + `<AgendaPage />`
- [ ] `src/features/caja/caja-page.tsx` — `CajaModuleProvider` + `<CajaPage />`
- [ ] Optional: `notifications-bell.tsx` + `use-notifications.ts`
- [ ] Routes `/admin/agenda`, `/admin/caja` + sidebar + `ROUTE_TITLES`
- [ ] Restart dev server after Vite config changes; clear `node_modules/.vite` if hooks break

### Reference implementations

| Nodo | Agenda | Caja | Tenant | Schema |
|------|--------|------|--------|--------|
| **nodo-autos** | `src/features/agenda/` | `src/features/caja/` | `cliente_id` | `nodo_autos` |
| **nodo-inmo** | `src/features/agenda/` | local (rendiciones stay local) | `org_id` | `nodo_inmo` |

Copy **nodo-autos** or **nodo-inmo** as template; always use the nodo's dedicated schema, not `public`.

---

Full scaffold checklist: `.atl/skills/nodo-scaffold/SKILL.md` (section **9. Shared nodo modules**).

Registration signup (nombre + email only, no password on signup): `.atl/skills/nodo-registration/SKILL.md`.
