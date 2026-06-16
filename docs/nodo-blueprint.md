# Blueprint: Agregar un nuevo nodo al ecosistema Nodo Core

Guía paso a paso para integrar un nuevo microfrontend (nodo) al monorepo.
Tiempo estimado: **menos de 30 minutos**.

---

## Requisitos previos

- Acceso al monorepo `nodocoreIT/nodo-core` (el repo se llama nodo-core en GitHub)
- pnpm >= 10 instalado
- Puerto disponible para desarrollo local (ver convención al final)

---

## Pasos

### 1. Crear la app Vite en el monorepo

```bash
cd /ruta/al/monorepo
pnpm create vite nodo-finanzas --template react-ts
```

Mover al directorio raíz del monorepo:
```
nodocore/
├── nodo-landing/
├── nodo-inmo/
├── nodo-finanzas/   ← acá
└── packages/
```

### 2. Registrar en pnpm-workspace.yaml

Agregar la nueva app al workspace:

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'nodo-landing'
  - 'nodo-inmo'
  - 'nodo-finanzas'   # ← agregar
```

Ejecutar `pnpm install` desde la raíz para que Turborepo reconozca el nuevo paquete.

### 3. Configurar el basename del router

El nodo debe manejar sus rutas bajo el prefijo `/<nombre-del-nodo>`:

```tsx
// nodo-finanzas/src/app/router.tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";

export function AppRouter() {
  return (
    <BrowserRouter basename="/finanzas">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Dashboard />} />
        {/* ... resto de rutas */}
      </Routes>
    </BrowserRouter>
  );
}
```

### 4. Instalar y consumir @nodocore/shared-components

```bash
pnpm --filter nodo-finanzas add @nodocore/shared-components
```

En el nodo:

```tsx
import { AuthProvider, useAuth, RequireAuth, Button, Input } from "@nodocore/shared-components";
import "@nodocore/shared-components/styles/base.css";
```

Wrappear la app con los providers:

```tsx
// nodo-finanzas/src/main.tsx
import { SupabaseProvider, AuthProvider } from "@nodocore/shared-components";
import { supabase } from "./lib/supabase"; // cliente propio del nodo

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SupabaseProvider client={supabase}>
      <AuthProvider config={finanzasAuthConfig}>
        <AppRouter />
      </AuthProvider>
    </SupabaseProvider>
  </StrictMode>
);
```

### 5. Registrar el rewrite en nodo-landing

En `nodo-landing/next.config.ts`, agregar en el array de `rewrites()`:

```ts
const NODO_FINANZAS_URL = process.env.NODO_FINANZAS_URL ?? "http://localhost:5175";

// Dentro de rewrites():
{
  source: "/finanzas",
  destination: `${NODO_FINANZAS_URL}/finanzas`,
},
{
  source: "/finanzas/:path*",
  destination: `${NODO_FINANZAS_URL}/finanzas/:path*`,
},
// Assets Vite (solo dev):
{
  source: "/@vite-finanzas/:path*", // si hay conflicto de assets
  destination: `${NODO_FINANZAS_URL}/@vite/:path*`,
},
```

> **Nota dev**: si corrés múltiples nodos Vite al mismo tiempo, cada uno necesita
> un puerto distinto. En producción cada app tiene su propia URL de deployment.

### 6. Agregar la variable de entorno

En `nodo-landing/.env.local`:
```
NODO_FINANZAS_URL=http://localhost:5174
```

En Vercel (producción):
```
NODO_FINANZAS_URL=https://nodofinanzas.vercel.app
```

### 7. Actualizar el login en nodo-landing (si el nodo tiene auth)

En `nodo-landing/app/[nodeSlug]/login/page.tsx`, agregar el caso del nuevo nodo:

```tsx
if (nodeParam === "nodo-finanzas" || nodeParam === "finanzas") {
  router.push("/finanzas");
}
```

### 8. Configurar el puerto de dev del nodo

En `nodo-finanzas/vite.config.ts`:

```ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174, // usar el siguiente puerto disponible (ver tabla al final)
    strictPort: true, // fallar rápido si el puerto está ocupado
  },
});
```

---

## Convención de puertos de desarrollo

| App | Puerto |
|-----|--------|
| nodo-landing (Next.js) | 3000 |
| nodo-inmo (Vite) | 5173 |
| nodo-finanzas (Vite) | 5174 |
| nodo-obra (Vite) | 5175 |
| nodo-seguros (Vite) | 5176 |

---

## Convención de rutas públicas

| Nodo | Ruta en nodo-landing | basename del router |
|------|-------------------|---------------------|
| nodo-inmo | `/inmo/*` | `/inmo` |
| nodo-finanzas | `/finanzas/*` | `/finanzas` |
| nodo-obra | `/obra/*` | `/obra` |
| nodo-seguros | `/seguros/*` | `/seguros` |

---

## Verificación rápida

```bash
# Desde la raíz del monorepo:
pnpm install                           # resolver dependencias
pnpm dev:core                          # levantar el shell (Next.js)
pnpm --filter nodo-finanzas dev        # levantar el nuevo nodo

# Navegar a http://localhost:3000/finanzas
# Debería cargar la app de nodo-finanzas sin redirect
```
