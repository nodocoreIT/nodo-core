# Design: Refactor Arquitectura Microfrontends -- nodocore

## Diagrama de Arquitectura

```
                        BROWSER
                           |
                    +------+------+
                    |  nodo-core  |  Next.js 16 (Shell / Proxy)
                    |  :3000      |
                    +------+------+
                           |
              +------------+------------+
              |                         |
     /inmo/** (rewrite proxy)    /panel, /, /{nodo}/*
     → nodoinmo.vercel.app       Paginas Next.js nativas
              |
     +--------+--------+
     |   nodo-inmo      |  Vite 6 (standalone, Multi-Zone)
     |   :5174 (dev)   |
     |   BrowserRouter  |
     |   basename=/inmo |
     +------------------+
              |
     @nodocore/shared-components (workspace dep)
     - UI primitives (Button, Card, etc.)
     - AuthProvider + useAuth (JWT decode)
     - SupabaseProvider
     - Hooks (theme, search, UI store)

     Supabase nodo-inmo (instancia separada)
```

```
Browser
  └── nodocore.com.ar
       ├── /                    → nodo-core (Next.js)
       ├── /panel/**            → nodo-core (Next.js)
       ├── /{nodo}/login        → nodo-core (Next.js)
       └── /inmo/**             → proxy → nodoinmo.vercel.app/inmo/**
                                          (nodo-inmo Vite, independiente)
```

```
Build Order (Turborepo):

  shared-components ──> nodo-inmo  ──> (dev/build independientes)
          |
          +----------> nodo-core  ──> (sin dependencia de build sobre nodo-inmo)
```

## Decisiones de Arquitectura

### Decision 1: Tooling MFE -- Multi-Zone Architecture

| Opcion | Pros | Contras | Veredicto |
|--------|------|---------|-----------|
| `@module-federation/nextjs-mf` (host) + `@originjs/vite-plugin-federation` (remote) | Combo conocido en la comunidad | **DESCARTADO**: `nextjs-mf` está abandonado, incompatible con Next.js 16 + App Router; requiere desactivar Turbopack; el ecosistema MF v1.0 no tiene mantenimiento activo | **DESCARTADO** |
| `@module-federation/enhanced` (MF 2.0) ambos | API unificada, runtime sharing mejorado | Soporte Next.js 16 experimental, documentacion escasa para Vite 6, riesgo de incompatibilidad alto | Rechazado |
| `@module-federation/vite` en ambos | Mismo plugin host+remote | No existe adapter Next.js; requeriria custom webpack config compleja en Next.js | Rechazado |
| **Multi-Zone Architecture** (patron oficial Next.js) | Sin dependencias experimentales, patron probado en produccion (ya funciona para nodo-clinica), compatible con Next.js 16 + App Router + Turbopack, cada nodo se deploya de forma totalmente independiente, sin cambios de bundler | Requiere configurar `basename` en el router del remote; la comunicacion cross-zone es a nivel browser (cookies/localStorage) | **ELEGIDO** |

**Rationale**: `@module-federation/nextjs-mf` está abandonado y no es compatible con Next.js 16.2.6 + App Router. Multi-Zone Architecture es el patron oficial de Next.js para componer aplicaciones independientes bajo un mismo dominio. Es exactamente el mismo mecanismo que ya funciona para nodo-clinica en este monorepo: nodo-core actua como proxy transparente via `rewrites`, el usuario no ve ninguna redireccion, y cada nodo se deploya de forma completamente autonoma.

### Decision 2: Auth Contract Unificado

**Choice**: Adoptar el patron JWT decode que nodo-inmo ya usa (`readClaims` via `atob`) como el contrato canonico en `@nodocore/shared-components`.

**Alternativas rechazadas**:
- `session.user.app_metadata` directo (lo que shared-components usa hoy): No refleja claims inyectados por Custom Access Token Hook de Supabase -- nodo-inmo ya descubrio esto.
- Libreria `jose` o `jwt-decode`: Dependencia innecesaria para decode sin verificacion (la verificacion la hace Supabase server-side).

**Contrato**:

```typescript
// packages/shared-components/src/providers/auth-provider.tsx
// readClaims reemplaza extractMeta actual

function readClaims(session: Session | null): {
  role: string | null;
  orgId: string | null;
  plan: string | null;
} {
  const token = session?.access_token;
  if (!token) return { role: null, orgId: null, plan: null };
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return {
      role: payload.app_metadata?.role ?? null,
      orgId: payload.app_metadata?.org_id ?? null,
      plan: payload.app_metadata?.plan ?? null,
    };
  } catch {
    return { role: null, orgId: null, plan: null };
  }
}
```

**Token refresh**: `onAuthStateChange` ya dispara con el nuevo token. `readClaims` se ejecuta en cada render del provider (derivado de `session` state), asi que el refresh es automatico sin logica adicional.

**Impacto en nodo-inmo**: Eliminar `src/app/auth/use-auth.tsx` local y los 54 archivos que lo importan. Reemplazar con `import { useAuth } from '@nodocore/shared-components'`. El `AuthProvider` de shared-components debe aceptar un `SupabaseClient` inyectado (ya lo hace via `useSupabase()`), eliminando el import directo de `supabase` singleton.

### Decision 3: Routing Multi-Zone

**Choice**: Next.js `rewrites` en nodo-core que proxean `/inmo/**` al deployment independiente de nodo-inmo. nodo-inmo usa `BrowserRouter` con `basename: '/inmo'`.

```
nodo-core (proxy):
  next.config.ts → rewrites /inmo/:path* → NODO_INMO_URL/inmo/:path*
  Sin catch-all pages, sin next/dynamic, sin Module Federation

nodo-inmo (standalone):
  BrowserRouter con basename="/inmo"
  Rutas internas: /inmo/admin/*, /inmo/owner/*, /inmo/login, etc.
  Corre en localhost:5174 (dev) o nodoinmo.vercel.app (prod)
```

**Dual-mode eliminado**: A diferencia del approach Module Federation, nodo-inmo NO necesita un modo embebido separado. Siempre usa `BrowserRouter` con `basename='/inmo'`. El proxy de nodo-core es transparente -- el browser ve la misma URL, nodo-inmo sirve el contenido.

**Auth flow cross-zone**:
- nodo-core genera el JWT via login unificado en `/{nodo}/login`
- nodo-inmo recibe la sesion via Supabase client-side (mismo token en localStorage/cookies del browser)
- La sesion persiste cross-origin correctamente si ambas apps comparten el mismo dominio base o se configura CORS adecuadamente
- En dev: nodo-core en `:3000`, nodo-inmo en `:5174` -- el proxy evita problemas CORS porque el browser solo habla con `:3000`

**Alternativa rechazada**: Catch-all route + `MemoryRouter` + Module Federation -- descartado por incompatibilidad de `nextjs-mf` con Next.js 16 + App Router (ver Decision 1).

### Decision 4: Shared Components Build

**Choice**: `tsup` como bundler para `@nodocore/shared-components`.

| Opcion | Pros | Contras | Veredicto |
|--------|------|---------|-----------|
| tsup | Zero-config para libs TS/React, genera ESM + dts, rapido (esbuild) | Dependencia adicional | **ELEGIDO** |
| Vite library mode | Ya disponible en el stack | Requiere configuracion manual para dts, peer deps handling mas fragil | Rechazado |
| Sin bundler (source TS directo) | Lo que hacen hoy | Funciona solo con transpiladores que soporten TS -- Next.js lo tolera pero no escala bien para consumidores Vite | Rechazado |

**Config base**:

```typescript
// packages/shared-components/tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  external: ["react", "react-dom", "@supabase/supabase-js", "zustand"],
  sourcemap: true,
  clean: true,
});
```

**package.json exports actualizados**:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs"
    },
    "./styles/base.css": "./src/styles/base.css"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch"
  }
}
```

### Decision 5: Comunicacion Cross-Zone

**Choice**: Sesion compartida via Supabase client-side. No hay comunicacion directa entre zones -- cada nodo es autonomo y lee su propia sesion de Supabase.

Cuando el usuario necesita navegar fuera del scope de nodo-inmo (ej: logout -> landing de nodo-core), usa un link `<a href="/">` comun. No se necesita ningun mecanismo de mensajeria cross-frame porque no hay iframes -- son dos deployments independientes bajo el mismo dominio via proxy.

```typescript
// nodo-inmo: navegacion de salida es un link normal
<a href="/panel">Volver al panel</a>  // nodo-core maneja esto
```

## Configuraciones Base

### next.config.ts del Host (nodo-core)

```typescript
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Rutas de la app nodo-inmo
      {
        source: '/inmo/:path*',
        destination: `${process.env.NODO_INMO_URL}/inmo/:path*`,
      },
      // Assets de dev Vite (solo necesario en desarrollo)
      {
        source: '/@vite/:path*',
        destination: `${process.env.NODO_INMO_URL}/@vite/:path*`,
      },
      {
        source: '/assets/:path*',
        destination: `${process.env.NODO_INMO_URL}/assets/:path*`,
      },
    ];
  },
};
```

### Routing en nodo-inmo

```typescript
// nodo-inmo/src/main.tsx
import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter basename="/inmo">
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  </BrowserRouter>
);
```

### Turbo Pipeline

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    }
  }
}
```

### Variables de Entorno

| Variable | Dev | Produccion |
|----------|-----|------------|
| `NODO_INMO_URL` | `http://localhost:5174` | `https://nodoinmo.vercel.app` |
| Patron para nuevos nodos | `NODO_{SLUG}_URL` | URL del deployment independiente del nodo |

> **Nota**: La variable es `NODO_INMO_URL` (sin prefijo `NEXT_PUBLIC_`) porque solo se usa en `next.config.ts` en el servidor, nunca en el cliente.

### Puertos por Convencion (dev)

| App | Puerto |
|-----|--------|
| nodo-core (shell/proxy) | 3000 |
| nodo-inmo | 5174 |
| Futuro: nodo-obra | 5175 |
| Futuro: nodo-contable | 5176 |

## Convencion para Nuevos Nodos (Blueprint Multi-Zone)

Todo nuevo nodo DEBE cumplir:

| Requisito | Detalle |
|-----------|---------|
| `basename` en router | `BrowserRouter basename="/{slug}"` — todas las rutas internas bajo ese prefijo |
| Registro en nodo-core | Agregar rewrite en `next.config.ts`: `source: '/{slug}/:path*'` → `NODO_{SLUG}_URL/{slug}/:path*` |
| Variable de entorno | `NODO_{SLUG}_URL` en `.env.local` (dev) y en Vercel (prod) |
| Deployment independiente | Cada nodo tiene su propio proyecto en Vercel (o equivalente) |
| Auth | Consumir `AuthProvider` + `useAuth` de `@nodocore/shared-components` |
| Supabase | Instancia propia, inyectada via `SupabaseProvider` del shared package |
| CSS | Tailwind v4, importar `@nodocore/shared-components/styles/base.css` para tokens compartidos |
| Navegacion de salida | Links `<a href="...">` comunes hacia rutas de nodo-core; no se necesita mensajeria cross-zone |

## File Changes

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `pnpm-workspace.yaml` | Modify | Agregar `nodo-core` al workspace |
| `packages/shared-components/src/providers/auth-provider.tsx` | Modify | Reemplazar `extractMeta` por `readClaims` (JWT decode) |
| `packages/shared-components/tsup.config.ts` | Create | Configuracion de build con tsup |
| `packages/shared-components/package.json` | Modify | Agregar script build, actualizar exports a dist/ |
| `nodo-inmo/src/main.tsx` | Modify | Agregar `basename="/inmo"` al BrowserRouter |
| `nodo-inmo/src/app/auth/use-auth.tsx` | Delete | Reemplazado por shared-components AuthProvider |
| `nodo-inmo/src/app/providers.tsx` | Modify | Usar AuthProvider de shared-components |
| `nodo-core/next.config.ts` | Modify | Agregar rewrites Multi-Zone para `/inmo/**` y assets Vite |
| `nodo-core/.env.local` | Modify | Agregar `NODO_INMO_URL=http://localhost:5174` |
| `turbo.json` | Modify | dev task con dependsOn ^build, outputs incluyen .next |

**Archivos eliminados del plan original (Module Federation)**:
- `nodo-inmo/src/bootstrap.tsx` — ya no se necesita entry point MFE separado
- `nodo-inmo/src/app/router.tsx` — ya no se necesita extraer Routes sin BrowserRouter
- `nodo-core/app/inmo/[...slug]/page.tsx` — ya no se necesita catch-all page

## Testing Strategy

| Capa | Que Testear | Approach |
|------|-------------|----------|
| Unit | `readClaims` en shared-components | Vitest -- JWT mock con payloads validos/invalidos/malformados |
| Unit | Rutas de nodo-inmo con `basename="/inmo"` | Vitest + RTL -- `MemoryRouter` con `basename`, verifica que rutas resuelven correctamente |
| Integration | Auth flow cross-zone | Login en nodo-core -> verificar que nodo-inmo lee la misma sesion Supabase |
| Integration | Proxy rewrites | Dev: verificar que `/inmo/*` proxea correctamente a `:5174`; assets Vite cargan |
| E2E | Navegacion completa | (Futuro) Playwright: navegar `/inmo/admin` desde nodo-core, verificar contenido de nodo-inmo |

## Migration / Rollout

Cada fase es un PR independiente con rollback autonomo (detallado en proposal). Orden estricto: Fase 1 -> Fase 2 -> Fase 3. No hay migracion de datos. Feature flag no necesario: el cambio es de infraestructura, no de UX.

**Rollback de Fase 3 (Multi-Zone)**: remover los rewrites de `next.config.ts` y la variable `NODO_INMO_URL`. nodo-inmo sigue funcionando standalone sin interrupcion.

## Open Questions

- [ ] Confirmar configuracion de sesion Supabase cross-zone en produccion (mismo dominio base via proxy -- deberia funcionar sin CORS issues, pero requiere validacion)
- [ ] Decidir si nodo-inmo usa su propia instancia Supabase o la del host (propuesta: propia, cada nodo es autonomo)
- [x] ~~Confirmar que `@module-federation/nextjs-mf` soporta Next.js 16.2.6~~ -- RESUELTO: descartado, incompatible
