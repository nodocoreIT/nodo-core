# Tasks: Refactor Arquitectura Microfrontends — mfe-refactor

> Generado: 2026-06-13
> Delivery strategy: ask-on-risk
> Artifact store: openspec

---

## Resumen de Dependencias

```
FASE 1 (Fundación Monorepo)
  T1-01 ──> T1-02 ──> T1-03 ──> T1-04 ──> T1-05
                                             |
FASE 2 (Auth Unificado + Shared Components)  |
  T2-01 ──> T2-02 ──┐                       |
  T2-03 ──> T2-04 ──┤ todos dependen de T1-05
  T2-05 ────────────┤
  T2-06 ──> T2-07 ──> T2-08 ──> T2-09
  (T2-06 bloquea T2-07 que bloquea T2-08)

FASE 3 (Multi-Zone Architecture)
  T3-01 ──> T3-02 ──> T3-03 ──> T3-04 ──> T3-05 ──> T3-06
  (todos dependen de T2-09, cadena lineal)
```

---

## FASE 1 — Fundación del Monorepo

### T1-01 — Corregir pnpm-workspace.yaml

**Requisitos cubiertos**: REQ-F1-01

**Descripción**: Agregar `apps/nodo-core` al listado de paquetes en `pnpm-workspace.yaml`. Verificar que todos los packages (apps/nodo-inmo, apps/nodo-clinica, packages/*) estén presentes.

**Archivos afectados**:
- `pnpm-workspace.yaml`

**Criterio de done**:
- El archivo lista explícitamente `apps/nodo-core`, `apps/nodo-inmo`, `apps/nodo-clinica`, `packages/*`
- `pnpm ls -r` muestra todos los workspaces sin error

**Paralelo con**: ninguno (bloqueante raíz)

**Commit**: `chore(workspace): add nodo-core to pnpm-workspace.yaml`

---

### T1-02 — Alinear versiones de dependencias compartidas

**Requisitos cubiertos**: REQ-F1-02, REQ-F1-03

**Descripción**: Auditar y unificar versiones de `react@19.x`, `react-dom@19.x`, `tailwindcss@4.x`, `@supabase/supabase-js@2.x`, `zustand@5.x`, `lucide-react` en todos los `package.json` del monorepo. Si hay divergencias, alinear al valor más reciente compatible. Usar `pnpm.overrides` en la raíz si corresponde para forzar una única resolución de `lucide-react`.

**Archivos afectados**:
- `package.json` (raíz)
- `apps/nodo-core/package.json`
- `apps/nodo-inmo/package.json`
- `packages/shared-components/package.json`

**Criterio de done**:
- `pnpm why react` retorna una sola versión en todo el workspace
- `pnpm why lucide-react` retorna una sola versión
- Sin advertencias de peer dep en `pnpm install`

**Depende de**: T1-01
**Paralelo con**: ninguno

**Commit**: `chore(deps): align shared dependency versions across workspace`

---

### T1-03 — Corregir turbo.json pipeline

**Requisitos cubiertos**: REQ-F1-04

**Descripción**: Actualizar `turbo.json` para declarar correctamente las tasks `build`, `dev`, `lint`, `test` con sus dependencias entre paquetes. `build` debe tener `"dependsOn": ["^build"]` y `"outputs": ["dist/**", ".next/**"]`. `dev` debe tener `"dependsOn": ["^build"]`, `"cache": false`, `"persistent": true`.

**Archivos afectados**:
- `turbo.json`

**Criterio de done**:
- `turbo build` construye shared-components antes que las apps
- `turbo dev` arranca las apps en el orden correcto
- Sin errores de pipeline en `turbo run build --dry-run`

**Depende de**: T1-02
**Paralelo con**: ninguno

**Commit**: `chore(turbo): fix build pipeline with correct task dependencies`

---

### T1-04 — Agregar @nodocore/shared-components como workspace dep en nodo-inmo

**Requisitos cubiertos**: REQ-F1-01 (resolución cruzada)

**Descripción**: Declarar `"@nodocore/shared-components": "workspace:*"` en `apps/nodo-inmo/package.json` bajo `dependencies`. Verificar que el symlink se crea correctamente en `node_modules`.

**Archivos afectados**:
- `apps/nodo-inmo/package.json`

**Criterio de done**:
- `node_modules/@nodocore/shared-components` en nodo-inmo apunta al directorio local (symlink)
- `import { useAuth } from '@nodocore/shared-components'` resuelve sin error de módulo

**Depende de**: T1-03
**Paralelo con**: ninguno

**Commit**: `chore(nodo-inmo): add @nodocore/shared-components workspace dependency`

---

### T1-05 — Verificar pnpm install limpio

**Requisitos cubiertos**: REQ-F1-05

**Descripción**: Ejecutar `pnpm install` desde la raíz y documentar el resultado. Si hay errores residuales de peer deps, resolverlos en este task. Este task es el gate de salida de Fase 1.

**Archivos afectados**:
- `pnpm-lock.yaml` (actualizado por pnpm)

**Criterio de done**:
- `pnpm install` finaliza sin errores
- `pnpm-lock.yaml` commiteado con estado limpio
- `pnpm ls -r` no muestra conflictos de versión

**Depende de**: T1-04
**Paralelo con**: ninguno

**Commit**: `chore(workspace): clean install — lock file after dependency alignment`

---

## FASE 2 — Auth Unificado + Shared Components

> Todos los tasks de Fase 2 dependen de que T1-05 esté completo.

### T2-01 — Configurar build de shared-components con tsup

**Requisitos cubiertos**: (enabler de REQ-F2-01, REQ-F2-02, REQ-F2-03, REQ-F2-04)

**Descripción**: Instalar `tsup` como devDependency en `packages/shared-components`. Crear `tsup.config.ts` con entry `src/index.ts`, formato `esm`, `dts: true`, externals: `react`, `react-dom`, `@supabase/supabase-js`, `zustand`. Actualizar `package.json` del paquete: agregar scripts `build` y `dev`, actualizar campo `exports` para apuntar a `dist/index.mjs` y `dist/index.d.ts`. Agregar `./styles/base.css` en exports si existe.

**Archivos afectados**:
- `packages/shared-components/tsup.config.ts` (crear)
- `packages/shared-components/package.json`

**Criterio de done**:
- `pnpm --filter @nodocore/shared-components build` produce `dist/index.mjs` y `dist/index.d.ts`
- No hay errores de TypeScript en el build
- Los tipos son correctamente exportados

**Depende de**: T1-05
**Paralelo con**: T2-05

**Commit**: `build(shared-components): add tsup bundler configuration`

---

### T2-02 — Refactorizar AuthProvider con JWT decode (readClaims)

**Requisitos cubiertos**: REQ-F2-01, REQ-F2-02

**Descripción**: En `packages/shared-components/src/providers/auth-provider.tsx`, reemplazar la función `extractMeta` (que lee `user.app_metadata`) por `readClaims` que hace `atob` decode del JWT access_token. La función `readClaims` recibe `Session | null` y retorna `{ role, orgId, plan }`. `AuthContextValue` debe exponer: `user`, `session`, `role`, `orgId`, `plan`, `isLoading`, `signIn`, `signOut`, `signInWithPassword` (retornando `AuthResponse` de `@supabase/supabase-js`).

**Archivos afectados**:
- `packages/shared-components/src/providers/auth-provider.tsx`
- `packages/shared-components/src/types/auth.ts` (si existe — actualizar interfaz)

**Criterio de done**:
- `readClaims` es la única función que lee role/orgId/plan
- No existe referencia a `user.app_metadata` para role/orgId/plan en el provider
- `AuthContextValue` incluye `signInWithPassword` con tipo `(credentials) => Promise<AuthResponse>`
- Tests unitarios pasan (ver T2-03)

**Depende de**: T2-01
**Paralelo con**: T2-05

**Commit**: `feat(shared-components): replace extractMeta with readClaims JWT decode`

---

### T2-03 — Tests unitarios para readClaims

**Requisitos cubiertos**: REQ-F2-01 (criterio de aceptación verificable)

**Descripción**: Crear tests Vitest para `readClaims` con casos: JWT válido con claims, JWT válido sin claims, token malformado (no lanza excepción), session null. Crear también test básico de `RequireAuth`: redirige sin sesión, renderiza children con sesión activa (REQ-F2-05).

**Archivos afectados**:
- `packages/shared-components/src/providers/auth-provider.test.ts` (crear)

**Criterio de done**:
- `pnpm --filter @nodocore/shared-components test` pasa con los 5+ casos cubiertos
- Coverage de `readClaims` al 100%

**Depende de**: T2-02
**Paralelo con**: T2-05, T2-06

**Commit**: `test(shared-components): unit tests for readClaims and RequireAuth`

---

### T2-04 — Verificar RequireAuth con nuevo AuthProvider

**Requisitos cubiertos**: REQ-F2-05

**Descripción**: Revisar `RequireAuth` en shared-components para confirmar que funciona correctamente con el nuevo `AuthProvider` (JWT decode). Si `RequireAuth` usa `user` o `session` directamente (no `role/orgId/plan`), probablemente no necesita cambios. Documentar resultado.

**Archivos afectados**:
- `packages/shared-components/src/components/require-auth.tsx`

**Criterio de done**:
- `RequireAuth` redirige a login cuando `user === null` y `isLoading === false`
- `RequireAuth` renderiza children cuando hay sesión válida
- Tests del T2-03 cubren este comportamiento

**Depende de**: T2-03
**Paralelo con**: T2-06

**Commit**: `fix(shared-components): ensure RequireAuth compatible with new AuthProvider`

---

### T2-05 — Eliminar copias locales de UI en nodo-inmo (src/shared/components/ui/)

**Requisitos cubiertos**: REQ-F2-03

**Descripción**: Eliminar el directorio `apps/nodo-inmo/src/shared/components/ui/` (7+ archivos: Button, Card, Input, etc.). Actualizar todos los imports en nodo-inmo que apuntan a `src/shared/components/ui/*` para que importen de `@nodocore/shared-components`. Usar búsqueda de texto para encontrar todos los imports afectados.

**Archivos afectados**:
- `apps/nodo-inmo/src/shared/components/ui/` (eliminar directorio)
- Todos los archivos en `apps/nodo-inmo/src/` que importan de `../shared/components/ui` o paths similares

**Criterio de done**:
- El directorio `src/shared/components/ui/` no existe
- `rg "shared/components/ui" apps/nodo-inmo/src` retorna cero resultados
- `pnpm --filter nodo-inmo build` compila sin errores

**Depende de**: T1-05 (workspace dep resuelto), T2-01 (shared-components buildeable)
**Paralelo con**: T2-01, T2-02

**Commit**: `refactor(nodo-inmo): remove local UI copies, import from @nodocore/shared-components`

---

### T2-06 — Eliminar use-auth.tsx local en nodo-inmo

**Requisitos cubiertos**: REQ-F2-04

**Descripción**: Eliminar `apps/nodo-inmo/src/app/auth/use-auth.tsx`. Actualizar `apps/nodo-inmo/src/app/providers.tsx` para usar `AuthProvider` de `@nodocore/shared-components` en lugar del provider local.

**Archivos afectados**:
- `apps/nodo-inmo/src/app/auth/use-auth.tsx` (eliminar)
- `apps/nodo-inmo/src/app/providers.tsx`

**Criterio de done**:
- El archivo `src/app/auth/use-auth.tsx` no existe
- `providers.tsx` importa `AuthProvider` de `@nodocore/shared-components`
- Sin imports rotos en el build

**Depende de**: T2-04, T2-05
**Paralelo con**: T2-03, T2-04

**Commit**: `refactor(nodo-inmo): remove local use-auth, use AuthProvider from shared-components`

---

### T2-07 — Reemplazar imports de useAuth en nodo-inmo (54+ archivos)

**Requisitos cubiertos**: REQ-F2-04

**Descripción**: Reemplazar en masa todos los imports de `useAuth` (y hooks relacionados de auth) que apuntan a paths locales por `import { useAuth } from '@nodocore/shared-components'`. Usar `rg` para encontrar todos los archivos afectados y un script de reemplazo. Verificar que `AuthContextValue` de shared-components exponga todos los campos que los 54+ archivos consumen (role, orgId, plan, signOut, etc.).

**Archivos afectados**:
- 54+ archivos en `apps/nodo-inmo/src/` que importan auth local

**Criterio de done**:
- `rg "from.*app/auth/use-auth" apps/nodo-inmo/src` retorna cero resultados
- `rg "from.*use-auth" apps/nodo-inmo/src` retorna cero resultados
- `pnpm --filter nodo-inmo build` compila sin errores de TypeScript

**Depende de**: T2-06
**Paralelo con**: ninguno (es el paso más largo de Fase 2)

**Commit**: `refactor(nodo-inmo): replace 54+ local useAuth imports with shared-components`

---

### T2-08 — Confirmar independencia de nodo-core respecto a AuthProvider shared

**Requisitos cubiertos**: REQ-F2-06, REQ-F2-07

**Descripción**: Auditar `apps/nodo-core` para verificar que NO importa `AuthProvider` de `@nodocore/shared-components`. nodo-core debe seguir usando `@supabase/ssr` directamente. Verificar que cada app tiene sus propias variables de entorno Supabase (`NEXT_PUBLIC_SUPABASE_URL` en core, `VITE_SUPABASE_URL` en inmo).

**Archivos afectados**:
- `apps/nodo-core/.env.local` (verificar/documentar)
- `apps/nodo-inmo/.env.local` (verificar/documentar)

**Criterio de done**:
- `rg "AuthProvider" apps/nodo-core/` retorna cero resultados de `@nodocore/shared-components`
- Cada app tiene su propia `SUPABASE_URL` configurada
- nodo-core arranca sin depender del build de shared-components en runtime

**Depende de**: T2-07
**Paralelo con**: ninguno

**Commit**: `chore(nodo-core): verify auth independence from shared-components`

---

### T2-09 — Smoke test post-migración de auth

**Requisitos cubiertos**: REQ-F2-01 al REQ-F2-07 (validación integrada)

**Descripción**: Arrancar nodo-inmo en modo standalone (`pnpm --filter nodo-inmo dev`). Verificar manualmente (o con test de integración si existe): login funciona, role/orgId/plan se populan correctamente desde el JWT, RequireAuth protege rutas, logout limpia la sesión.

**Archivos afectados**:
- Ninguno (task de verificación)

**Criterio de done**:
- Login exitoso → `useAuth().role` tiene el valor correcto del JWT
- Acceder a ruta protegida sin sesión redirige a login
- `pnpm --filter nodo-inmo build` produce bundle sin errores
- `pnpm --filter @nodocore/shared-components build` pasa limpio

**Depende de**: T2-08
**Paralelo con**: ninguno

**Commit**: `test(nodo-inmo): smoke test auth migration — manual verification log`

---

## FASE 3 — Multi-Zone Integration

> Todos los tasks de Fase 3 dependen de que T2-09 esté completo.
> Estrategia: Next.js rewrites como proxy inverso entre nodo-core y nodo-inmo. Sin Module Federation, sin plugins de bundler adicionales.

### T3-01 — Agregar NODO_INMO_URL como variable de entorno

**Requisitos cubiertos**: REQ-F3-01

**Descripción**: Declarar `NODO_INMO_URL` en los archivos de entorno de nodo-core. En dev apunta a la instancia local de nodo-inmo; en producción apunta al dominio desplegado. Documentar el patrón `NODO_{SLUG}_URL` para futuros nodos en el README o en una sección de variables de entorno.

**Archivos afectados**:
- `apps/nodo-core/.env.local` — agregar `NODO_INMO_URL=http://localhost:5174`
- `apps/nodo-core/.env.production` — agregar `NODO_INMO_URL=https://nodoinmo.vercel.app`
- `apps/nodo-core/README.md` (o sección env vars existente) — documentar la variable

**Criterio de done**:
- La variable `NODO_INMO_URL` está definida en `.env.local` y `.env.production`
- `next.config.ts` puede leer `process.env.NODO_INMO_URL` sin error
- `.env.local` está en `.gitignore`

**Depende de**: T2-09
**Paralelo con**: ninguno

**Commit**: `chore(nodo-core): add NODO_INMO_URL env variable for multi-zone proxy`

---

### T3-02 — Configurar rewrites en next.config.ts de nodo-core

**Requisitos cubiertos**: REQ-F3-02

**Descripción**: En `apps/nodo-core/next.config.ts`, reemplazar el hard redirect a nodo-inmo por una función `async rewrites()` que proxea `/inmo/:path*` hacia `${NODO_INMO_URL}/inmo/:path*`. Agregar también rewrites de assets de Vite para que el dev server de nodo-inmo pueda servir correctamente en modo Multi-Zone: `/@vite/:path*` y `/assets/:path*` hacia `${NODO_INMO_URL}/:path*`.

**Archivos afectados**:
- `apps/nodo-core/next.config.ts`

**Criterio de done**:
- Navegando a `/inmo/*` en nodo-core el request se proxea a nodo-inmo sin redirect visible en la barra del navegador
- Assets de Vite (`/@vite/client`, `/assets/*.js`) cargan correctamente en dev
- `pnpm --filter nodo-core dev` arranca sin errores de configuración

**Depende de**: T3-01
**Paralelo con**: ninguno

**Commit**: `feat(nodo-core): configure multi-zone rewrites proxying /inmo/* to nodo-inmo`

---

### T3-03 — Configurar basename `/inmo` en nodo-inmo

**Requisitos cubiertos**: REQ-F3-03

**Descripción**: Actualizar el router de nodo-inmo para que use `basename="/inmo"`. Esto asegura que los links internos generados por react-router-dom incluyan el prefijo `/inmo/` y que las rutas coincidan correctamente cuando nodo-inmo es servido bajo ese path desde nodo-core.

**Archivos afectados**:
- `apps/nodo-inmo/src/main.tsx` (o el archivo donde esté `BrowserRouter`) — agregar `basename="/inmo"`

**Criterio de done**:
- nodo-inmo funciona correctamente bajo el prefijo `/inmo/` cuando es accedido a través del proxy de nodo-core
- nodo-inmo sigue funcionando en modo standalone (`pnpm --filter nodo-inmo dev`) sin regresión
- Los links internos generados incluyen el prefijo `/inmo/`

**Depende de**: T3-02
**Paralelo con**: ninguno

**Commit**: `feat(nodo-inmo): set basename /inmo on BrowserRouter for multi-zone routing`

---

### T3-04 — Reemplazar hard redirect por navegación interna en nodo-core

**Requisitos cubiertos**: REQ-F3-04

**Descripción**: Localizar en nodo-core el lugar donde se hace `window.location.href = "https://nodoinmo.vercel.app"` (o redirect equivalente al dominio externo de nodo-inmo) y reemplazarlo por `router.push('/inmo')` usando el router de Next.js. Esto elimina la navegación cross-origin y mantiene al usuario dentro del dominio de nodo-core.

**Archivos afectados**:
- `apps/nodo-core/app` — el componente o page donde está el redirect hardcodeado (probablemente relacionado con login exitoso)

**Criterio de done**:
- `rg "nodoinmo.vercel.app" apps/nodo-core/` retorna cero resultados
- `rg "window.location.href.*inmo" apps/nodo-core/` retorna cero resultados
- Login exitoso en nodo-core navega a `/inmo` sin cambiar de dominio

**Depende de**: T3-03
**Paralelo con**: ninguno

**Commit**: `fix(nodo-core): replace hard redirect with router.push('/inmo') post-login`

---

### T3-05 — Smoke test integración Multi-Zone

**Requisitos cubiertos**: REQ-F3-01 al REQ-F3-04

**Descripción**: Verificar el flujo completo de integración con nodo-inmo corriendo en `:5174` y nodo-core en `:3000`. Validar que el flujo de login y navegación funciona de punta a punta, que los assets cargan, y que el hot reload de Vite funciona en desarrollo.

**Archivos afectados**:
- Ninguno (task de verificación)

**Criterio de done**:
- Login en `/nodo-inmo/login` → auth exitosa → redirect a `/inmo/owner/*` dentro de nodo-core (sin cambio de dominio)
- Assets de nodo-inmo (CSS, JS) cargan correctamente cuando se accede via nodo-core
- Hot reload de Vite funciona en dev (cambios en nodo-inmo se reflejan sin reiniciar nodo-core)
- Flujo completo verificado tanto en dev como en preview

**Depende de**: T3-04
**Paralelo con**: ninguno

**Commit**: `test(integration): multi-zone smoke test — login flow and asset loading`

---

### T3-06 — Documentar blueprint para nuevos nodos

**Requisitos cubiertos**: REQ-BP-01, REQ-BP-02, REQ-BP-03

**Descripción**: Crear el documento de referencia para agregar nuevos nodos al monorepo usando la estrategia Multi-Zone. El objetivo es que cualquier desarrollador pueda incorporar un nuevo nodo en menos de 30 minutos siguiendo el checklist, sin necesidad de modificar lógica de nodo-core más allá de la configuración de rewrites.

**Archivos afectados**:
- `docs/nodo-blueprint.md` o `openspec/changes/mfe-refactor/blueprint.md` (crear)

**Criterio de done**:
- El documento existe con un checklist de ≤ 8 pasos enumerados y ejecutables
- Incluye: cómo configurar `basename` en el nuevo nodo, cómo registrar el rewrite en `next.config.ts` de nodo-core, cómo agregar la variable de entorno `NODO_{SLUG}_URL`, cómo consumir `@nodocore/shared-components`
- Un desarrollador nuevo puede seguirlo sin preguntas adicionales en < 30 minutos

**Depende de**: T3-05 (tiene el contexto completo de la config final)
**Paralelo con**: ninguno

**Commit**: `docs: add nodo-blueprint.md for multi-zone node integration`

---

## Review Workload Forecast

| Métrica | Valor |
|---------|-------|
| Archivos modificados/creados | ~60–70 |
| Líneas cambiadas estimadas | ~800–1.000 |
| Fase 3 (solo Multi-Zone) | ~60 líneas |
| **400-line budget risk** | **Medium** (Fase 2 sigue siendo el peso mayor) |
| **Chained PRs recommended** | **Yes** (principalmente por Fase 2) |
| **Decision needed before apply** | **Yes** |

### Breakdown por PR sugerido (si se adopta chained PRs)

| PR | Fase | Tasks incluidos | Líneas aprox. | Target |
|----|------|----------------|---------------|--------|
| PR #1 | Fase 1 | T1-01 a T1-05 | ~50 líneas | main |
| PR #2 | Fase 2 — Build + Auth | T2-01 a T2-04 | ~150 líneas | main |
| PR #3 | Fase 2 — Migration | T2-05 a T2-09 | ~600 líneas | main |
| PR #4 | Fase 3 — Multi-Zone | T3-01 a T3-06 | ~60 líneas + docs | main |

> El PR #3 sigue siendo el más pesado por el reemplazo masivo en 54+ archivos (T2-07). Se puede considerar un PR separado solo para T2-07 con un commit atómico de script de reemplazo.

---

## Tabla de Dependencias Completa

| Task | Depende de | Paralelo con |
|------|-----------|-------------|
| T1-01 | — | — |
| T1-02 | T1-01 | — |
| T1-03 | T1-02 | — |
| T1-04 | T1-03 | — |
| T1-05 | T1-04 | — |
| T2-01 | T1-05 | T2-05 |
| T2-02 | T2-01 | T2-05 |
| T2-03 | T2-02 | T2-05, T2-06 |
| T2-04 | T2-03 | T2-06 |
| T2-05 | T1-05, T2-01 | T2-01, T2-02 |
| T2-06 | T2-04, T2-05 | T2-03, T2-04 |
| T2-07 | T2-06 | — |
| T2-08 | T2-07 | — |
| T2-09 | T2-08 | — |
| T3-01 | T2-09 | — |
| T3-02 | T3-01 | — |
| T3-03 | T3-02 | — |
| T3-04 | T3-03 | — |
| T3-05 | T3-04 | — |
| T3-06 | T3-05 | — |
