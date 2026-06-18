---
name: nodo-scaffold
description: Checklist and contracts for creating a new nodo app in the nodocore monorepo. Apply when scaffolding any new nodo (nodo-*, e.g. nodo-crm, nodo-contable, nodo-ventas).
trigger: new nodo, scaffold nodo, add nodo, crear nodo, nuevo nodo
scope: project
---

# Nodo Scaffold — Mandatory Checklist

Every new nodo in nodocore is a Vite + React 19 SPA that:
1. Lives under `nodo-<name>/` in the monorepo root
2. Gets proxied by `nodo-landing` (Next.js) under `/nodo-<name>/*` in `next.config.ts`
3. Uses `@nodocore/shared-components` for Auth, UI, and the Supabase client factory
4. Follows the patterns below **without exception**

---

## 1. Supabase Schema

Each nodo uses either:
- **A dedicated schema** in the shared Supabase project (e.g., `nodo_crm`), OR
- **Its own Supabase project** (for strong isolation)

Regardless of which, every nodo's initial migration MUST:

```sql
-- 1. Create/expose schema (if shared project)
create schema if not exists nodo_<name>;
grant usage on schema nodo_<name> to anon, authenticated, service_role;
alter default privileges in schema nodo_<name>
  grant all on tables to anon, authenticated, service_role;

-- 2. Tenant anchor table (equivalent of org_profiles / clientes)
-- MANDATORY: include theme_settings jsonb column from day one
create table nodo_<name>.org_settings (
  id            uuid primary key default gen_random_uuid(),
  -- ... nodo-specific columns ...
  theme_settings jsonb default null,   -- ← ALWAYS include this
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 3. RLS — SELECT + UPDATE for the org's admin role
alter table nodo_<name>.org_settings enable row level security;

create policy "org_settings: read own" on nodo_<name>.org_settings
  for select to authenticated
  using ( /* org_id or tenant_id from JWT app_metadata */ );

create policy "org_settings: admin update own" on nodo_<name>.org_settings
  for update to authenticated
  using ( /* same condition */ )
  with check ( /* same condition */ );
```

**Do NOT omit `theme_settings jsonb default null`.** Retrofitting this column later requires
a migration + type update. Include it on day one.

---

## 2. Theme Settings Hook

Copy `nodo-inmo/src/shared/hooks/use-theme-settings.ts` into `nodo-<name>/src/shared/hooks/use-theme-settings.ts`.

Change **only** these two values:

```ts
// localStorage key — must be unique per nodo
const STORAGE_KEY = "nodo-<name>-theme-settings";

export const DEFAULT_SETTINGS: ThemeSettings = {
  // ... (keep all other defaults identical) ...
  brandText: "nodo <name>",   // ← nodo-specific default brand label
};
```

The hook must export **both**:
- `useThemeSettings()` — function hook (applies CSS vars via useEffect)
- `useThemeStore` — raw Zustand store (needed by ThemeInitializer in providers)

---

## 3. Theme Sync Hook

Create `nodo-<name>/src/shared/hooks/use-<name>-theme-sync.ts`:

```ts
import { useEffect } from "react";
import { supabase } from "@/shared/lib/supabase";
import { useThemeStore, type ThemeSettings } from "./use-theme-settings";

/**
 * Loads theme_settings from the DB on mount and merges into the Zustand store.
 * Supabase wins over localStorage so all admins share the same branding.
 */
export function use<Name>ThemeSync() {
  const { setSettings } = useThemeStore();

  useEffect(() => {
    supabase
      .from("<org_table>")          // ← tenant anchor table name
      .select("theme_settings")
      .single()                      // RLS returns own row automatically
      .then(({ data }) => {
        if (data?.theme_settings && typeof data.theme_settings === "object") {
          setSettings(data.theme_settings as Partial<ThemeSettings>);
        }
      });
  }, [setSettings]);
}

/**
 * Persists theme_settings to the DB.
 * Call on settings dialog close (best-effort, localStorage is the fallback).
 */
export async function save<Name>ThemeSettings(settings: ThemeSettings): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await supabase.from("<org_table>").update({ theme_settings: settings as any });
  // No .eq() needed — RLS UPDATE policy restricts to own row.
}
```

If the tenant is identified by `auth.uid()` (not a tenant FK), use:
```ts
const { data: { user } } = await supabase.auth.getUser();
await supabase.from("<table>").update({ theme_settings: settings as any }).eq("id", user.id);
```

---

## 4. ThemeInitializer in providers.tsx

```tsx
import { useEffect, type ReactNode } from "react";
import { useThemeSettings, useThemeStore, type ThemeSettings } from "@/shared/hooks/use-theme-settings";
import { use<Name>ThemeSync } from "@/shared/hooks/use-<name>-theme-sync";

function ThemeInitializer({ children }: { children: ReactNode }) {
  // 1. Load from Supabase → merge into Zustand store
  use<Name>ThemeSync();

  // 2. Apply Zustand store → CSS custom properties on :root
  useThemeSettings();

  return <>{children}</>;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider client={supabase}>
        <AuthProvider config={AUTH_CONFIG}>
          <ThemeInitializer>{children}</ThemeInitializer>
        </AuthProvider>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}
```

`ThemeInitializer` MUST be inside `AuthProvider` (needs auth context for Supabase queries).

---

## 5. Settings Dialog

If the nodo has a settings UI (recommended), wire the save on dialog close:

```tsx
const handleOpenChange = useCallback(async (nextOpen: boolean) => {
  if (!nextOpen) {
    try {
      await save<Name>ThemeSettings(settings);
    } catch {
      // Best-effort — localStorage already has the settings as fallback
    }
  }
  onOpenChange(nextOpen);
}, [settings, onOpenChange]);
```

---

## 6. Landing Page Entry Point

In `nodo-landing/components/NodoPlaceholder.tsx`, add a case for the new slug:

```tsx
} : slug === "<name>" ? (
  <Link href="/nodo-<name>/login" className="...">
    Entrar a <Name>
  </Link>
) : (
```

In `nodo-landing/next.config.ts`, add the rewrite:

```ts
{
  source: "/nodo-<name>/:path*",
  destination: "http://localhost:<PORT>/nodo-<name>/:path*",
},
```

---

## 7. Checklist Before Merging a New Nodo

- [ ] `theme_settings jsonb default null` in tenant anchor table
- [ ] UPDATE RLS policy on that table for admin role
- [ ] `use-theme-settings.ts` with unique `STORAGE_KEY` and correct `brandText`
- [ ] `use-<name>-theme-sync.ts` with load + save functions
- [ ] `ThemeInitializer` in `providers.tsx` inside `AuthProvider`
- [ ] Settings dialog saves on close (if applicable)
- [ ] Landing entry point wired (`NodoPlaceholder.tsx` + `next.config.ts`)
- [ ] `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Migration SQL run in the correct Supabase project

---

## 8. Interactive affordances (cursor pointer)

Every nodo MUST show `cursor: pointer` (hand icon) on clickable controls — sidebar logout, nav items, icon buttons, etc.

**Mandatory in `src/index.css`** (after `@import "tailwindcss"`):

```css
@import "@nodocore/shared-components/styles/interactive.css";
```

This shared stylesheet sets `cursor: pointer` on native `<button>` and `[role="button"]` elements.

**Also use `@nodocore/shared-components` `Button`** for actions like "Cerrar sesión" — it includes `cursor-pointer` and `disabled:cursor-not-allowed` by default.

Do NOT rely on per-layout `className="cursor-pointer"` overrides; the shared layer covers all nodos and future ones.
