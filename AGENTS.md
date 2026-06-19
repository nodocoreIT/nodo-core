# nodocore — Agent guide

Monorepo of **nodo** apps (Vite + React 19 SPAs) proxied by `nodo-landing`, plus shared packages.

## Shared packages

| Package | Purpose |
|---------|---------|
| `@nodocore/shared-components` | Auth, UI, Supabase client factory, portal header |
| `@nodocore/nodo-modules` | Optional cross-nodo modules: **agenda**, **caja**, **notifications** |

## Installing shared modules in a nodo

Use `@nodocore/nodo-modules` when a nodo needs agenda/tareas, caja, or the notification bell — same UX as nodo-inmo, configured per tenant.

### 1. Dependency + Vite alias

```json
// nodo-<name>/package.json
"@nodocore/nodo-modules": "workspace:*"
```

```ts
// nodo-<name>/vite.config.ts — compile from source (same pattern as shared-components)
"@nodocore/nodo-modules/agenda": resolve(monorepoRoot, "packages/nodo-modules/src/agenda/index.ts"),
"@nodocore/nodo-modules/caja": resolve(monorepoRoot, "packages/nodo-modules/src/caja/index.ts"),
"@nodocore/nodo-modules/notifications": resolve(monorepoRoot, "packages/nodo-modules/src/notifications/index.ts"),
```

Add `@nodocore/nodo-modules` to `optimizeDeps.exclude`.

### 2. Database migration

Each module expects tenant-scoped tables with RLS. See `nodo-autos/supabase/migrations/006_tasks_and_caja.sql` for a reference on **`public`** schema:

- **Agenda:** `tasks` (+ optional FKs like `vehicle_id`, `customer_id`)
- **Caja:** `cash_movements`, optional `conceptos`, `cash_accounts`

Tenant column is usually `cliente_id` or `org_id` depending on the nodo.

### 3. Hooks factory

```ts
// src/shared/lib/<nodo>-module-hooks.ts
import { createTasksHooks } from "@nodocore/nodo-modules/agenda";
import { createCajaHooks } from "@nodocore/nodo-modules/caja";

export const myTasksHooks = createTasksHooks({
  queryKey: ["nodo-<name>", "tasks"],
  table: "tasks",
  tenantColumn: "cliente_id",
  getTenantId: () => getTenantIdFromStore(),
  supabase,
});
```

### 4. Agenda page wrapper

Provide `AgendaModuleProvider` with categories, assignees, link fields, and CRUD handlers, then render `<AgendaPage />`. Copy `nodo-autos/src/features/agenda/` as template.

### 5. Caja page wrapper

Provide `CajaModuleProvider` with movements + formatters, then render `<CajaPage />`. Copy `nodo-autos/src/features/caja/`.

### 6. Notification bell

Wire `PortalHeaderActions` / `PortalHeaderMobileActions` with:

```tsx
import { NotificationsDropdown, buildTaskNotifications } from "@nodocore/nodo-modules/notifications";
```

Combine `buildTaskNotifications({ tasks, agendaBasePath })` with nodo-specific signals (payments, stock alerts, etc.). See `nodo-autos/src/features/notifications/`.

### 7. Admin nav + routes

Add sidebar items and routes:

- `/admin/agenda` → agenda wrapper
- `/admin/caja` → caja wrapper

Register titles in `admin-layout.tsx` `ROUTE_TITLES`.

---

Full scaffold checklist: `.atl/skills/nodo-scaffold/SKILL.md` (section **9. Shared nodo modules**).

Reference implementations:

- **nodo-autos** — agenda, caja, bell (simpler caja than inmo)
- **nodo-inmo** — full caja + rendiciones (local code; migration to shared modules optional)
