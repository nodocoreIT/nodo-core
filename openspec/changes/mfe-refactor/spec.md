# Especificación: Refactor Arquitectura Microfrontends — mfe-refactor

## Propósito

Esta especificación describe el comportamiento requerido del sistema luego de aplicar el refactor MFE. Cubre cuatro dominios: configuración del workspace, contrato de autenticación compartida, Module Federation y blueprint para nuevos nodos. Es una spec completa (no delta) ya que los dominios afectados no tenían spec previa.

---

## Dominio: workspace-config

### Requisitos

| ID | Descripción | Criterio de Aceptación | Fase |
|----|-------------|------------------------|------|
| REQ-F1-01 | `pnpm-workspace.yaml` incluye todos los paquetes | El archivo lista `apps/nodo-core`, `apps/nodo-inmo`, `apps/nodo-clinica`, `packages/*` | 1 |
| REQ-F1-02 | Versiones alineadas de dependencias compartidas | `react@19.x`, `react-dom@19.x`, `tailwindcss@4.x`, `@supabase/supabase-js@2.x`, `zustand@5.x` coinciden en todos los paquetes | 1 |
| REQ-F1-03 | `lucide-react` usa una única versión en el monorepo | Un único valor en `pnpm-workspace.yaml` overrides o en cada `package.json`; sin versión duplicada/divergente | 1 |
| REQ-F1-04 | `turbo.json` define pipeline válida para todos los paquetes | `build`, `dev`, `lint`, `test` declarados con dependencias correctas entre paquetes | 1 |
| REQ-F1-05 | `pnpm install` resuelve sin errores | Cero errores de resolución de peers o conflictos de versión al ejecutar `pnpm install` desde la raíz | 1 |

### Requirement: Workspace Funcional

El monorepo MUST configurar `pnpm-workspace.yaml` de modo que todos los paquetes sean resolvibles entre sí via workspace protocol (`workspace:*`).

#### Scenario: Instalación limpia

- GIVEN el monorepo con `pnpm-workspace.yaml` corregido
- WHEN se ejecuta `pnpm install` desde la raíz
- THEN todas las dependencias resuelven sin errores de peer o versión conflictiva
- AND `node_modules` de cada app contiene symlinks correctos a `packages/shared-components`

#### Scenario: Resolución cruzada entre paquetes

- GIVEN `apps/nodo-inmo/package.json` declara `"@nodocore/shared-components": "workspace:*"`
- WHEN se resuelve la dependencia
- THEN apunta al código local en `packages/shared-components`, no a npm

#### Scenario: Versión divergente detectada

- GIVEN una app con versión de `react` diferente a la declarada en el workspace
- WHEN se ejecuta `pnpm install`
- THEN pnpm emite error o warning de conflicto de versión (no silencia la discrepancia)

---

## Dominio: shared-components

### Requisitos

| ID | Descripción | Criterio de Aceptación | Fase |
|----|-------------|------------------------|------|
| REQ-F2-01 | `AuthProvider` lee role/orgId/plan del JWT access_token | Se hace base64 decode del payload del JWT; NO se usa `user.app_metadata` como fuente de role/orgId/plan | 2 |
| REQ-F2-02 | `AuthContextValue` expone la interfaz completa | Expone: `user`, `session`, `role`, `orgId`, `plan`, `isLoading`, `signIn`, `signOut`, `signInWithPassword` (retorna `AuthResponse`) | 2 |
| REQ-F2-03 | nodo-inmo elimina copias locales de UI | `src/shared/components/ui/*` en nodo-inmo no existe; imports provienen de `@nodocore/shared-components` | 2 |
| REQ-F2-04 | nodo-inmo elimina auth hook local | `src/app/auth/use-auth.tsx` en nodo-inmo no existe; usa `useAuth` de `@nodocore/shared-components` | 2 |
| REQ-F2-05 | `RequireAuth` funciona con el nuevo `AuthProvider` | Componente redirige a login cuando no hay sesión activa; renderiza children cuando la sesión es válida | 2 |
| REQ-F2-06 | nodo-core no depende de `AuthProvider` de shared | nodo-core sigue usando `@supabase/ssr` directamente; no importa `AuthProvider` de shared-components | 2 |
| REQ-F2-07 | Cada app mantiene su propio cliente Supabase | Cada app configura `NEXT_PUBLIC_SUPABASE_URL`/`VITE_SUPABASE_URL` con su propia instancia; no comparten cliente | 2 |

### Requirement: Contrato de Auth Unificado

`AuthProvider` en `@nodocore/shared-components` MUST obtener `role`, `orgId` y `plan` del payload del JWT access_token, decodificado en cliente, como única fuente de verdad.

#### Scenario: Sesión activa con claims en JWT

- GIVEN un usuario autenticado cuyo access_token contiene `{ role: "admin", org_id: "org-123", plan: "pro" }`
- WHEN `AuthProvider` inicializa o refresca la sesión
- THEN `useAuth()` retorna `role = "admin"`, `orgId = "org-123"`, `plan = "pro"`
- AND los valores NO se leen de `user.app_metadata`

#### Scenario: JWT sin claims custom

- GIVEN un access_token válido pero sin campos `role`, `org_id` o `plan`
- WHEN `AuthProvider` decodifica el token
- THEN `role`, `orgId`, `plan` son `undefined` o `null`; no se lanza excepción

#### Scenario: Sin sesión activa

- GIVEN no hay sesión de Supabase
- WHEN el componente que usa `useAuth()` monta
- THEN `user = null`, `session = null`, `isLoading = false`

### Requirement: Eliminación de Copias Locales en nodo-inmo

nodo-inmo MUST NOT contener copias de componentes UI o auth hooks que ya existen en `@nodocore/shared-components`.

#### Scenario: Import de componente UI compartido

- GIVEN nodo-inmo importa `Button` o cualquier primitiva UI
- WHEN se resuelve el import
- THEN el módulo origen es `@nodocore/shared-components`, no un path local de `src/shared/`

#### Scenario: Uso de useAuth en nodo-inmo

- GIVEN un componente de nodo-inmo que necesita datos de sesión
- WHEN llama a `useAuth()`
- THEN el hook proviene de `@nodocore/shared-components`; no existe implementación local del hook

---

## Dominio: module-federation

### Requisitos

| ID | Descripción | Criterio de Aceptación | Fase |
|----|-------------|------------------------|------|
| REQ-F3-01 | nodo-inmo expone módulo raíz vía Module Federation | El plugin federation de Vite expone al menos un punto de entrada consumible por el host | 3 |
| REQ-F3-02 | nodo-core consume nodo-inmo vía `next/dynamic` | Existe import dinámico con `ssr: false` que carga el remote de nodo-inmo | 3 |
| REQ-F3-03 | React compartido como singleton | `react` y `react-dom` declarados como `shared` con `singleton: true`; una sola instancia en runtime | 3 |
| REQ-F3-04 | Hard redirect eliminado | No existe `window.location.href = "https://nodoinmo.vercel.app"` en nodo-core | 3 |
| REQ-F3-05 | Ruta pública del remote es `/inmo/*` | Las rutas internas de nodo-inmo se acceden bajo `/inmo/` en el host, no bajo `/nodo-inmo/` | 3 |
| REQ-F3-06 | nodo-inmo usa `MemoryRouter` internamente | El remote no manipula `window.history`; el host controla la URL del browser | 3 |
| REQ-F3-07 | Deploy independiente posible | nodo-core y nodo-inmo pueden desplegarse a producción de forma independiente sin romper el otro | 3 |

### Requirement: Carga Dinámica del Remote

nodo-core MUST cargar nodo-inmo como remote Module Federation client-side, sin SSR, reemplazando el hard redirect existente.

#### Scenario: Usuario navega a /inmo

- GIVEN nodo-core está en producción y nodo-inmo está deployado como remote
- WHEN el usuario accede a `/inmo` en el host
- THEN nodo-core carga el bundle del remote dinámicamente
- AND nodo-inmo se renderiza dentro del shell de nodo-core sin redirect

#### Scenario: Remote no disponible

- GIVEN nodo-inmo está caído o el bundle no es accesible
- WHEN nodo-core intenta cargar el remote
- THEN se muestra un error boundary o fallback UI
- AND nodo-core no crashea globalmente

#### Scenario: Singleton de React

- GIVEN host y remote se cargan en el mismo browser context
- WHEN React se inicializa
- THEN existe una sola instancia de `react` y `react-dom` en `window`; sin duplicación de contexto

### Requirement: Routing Controlado por el Host

El remote nodo-inmo MUST usar `MemoryRouter` (o equivalente) para su navegación interna, delegando el control de `window.history` al host.

#### Scenario: Navegación dentro del remote

- GIVEN el remote está montado bajo `/inmo`
- WHEN el usuario navega entre rutas internas del remote (ej: `/inmo/propiedades`, `/inmo/dashboard`)
- THEN la URL del browser cambia (controlada por el host)
- AND el remote actualiza su vista sin recargar la página

---

## Dominio: nodo-blueprint

### Requisitos

| ID | Descripción | Criterio de Aceptación | Fase |
|----|-------------|------------------------|------|
| REQ-BP-01 | Checklist documentada de ≤ 8 pasos para crear un nuevo nodo | Existe archivo de blueprint con pasos enumerados; cada paso es accionable y verificable | 3 |
| REQ-BP-02 | Setup de nuevo nodo completable en < 30 min | Un desarrollador que sigue el blueprint integra un nuevo remote sin conocimiento previo del monorepo en menos de 30 minutos | 3 |
| REQ-BP-03 | Zero cambios en nodo-core para agregar un nodo | Agregar un nuevo remote solo requiere registrar la URL del remote en la config del host; no modifica lógica existente | 3 |

### Requirement: Blueprint de Nuevos Nodos

MUST existir documentación accionable que permita a un desarrollador agregar un nuevo nodo remote al monorepo sin asistencia adicional.

#### Scenario: Desarrollador sigue el blueprint

- GIVEN la documentación del blueprint disponible en el repositorio
- WHEN un desarrollador crea una nueva app Vite, configura el plugin federation y la registra en nodo-core
- THEN el nuevo remote es accesible desde el host en la ruta configurada
- AND el proceso completo toma menos de 30 minutos

#### Scenario: Nuevo nodo no rompe el shell

- GIVEN un nuevo nodo remote registrado en nodo-core
- WHEN el remote no está disponible (no deployado aún)
- THEN nodo-core arranca y funciona normalmente; la ruta del nuevo nodo muestra fallback

---

## Tabla de Requerimientos Consolidada

| ID | Dominio | Descripción | Fase | RFC 2119 |
|----|---------|-------------|------|----------|
| REQ-F1-01 | workspace-config | pnpm-workspace.yaml completo | 1 | MUST |
| REQ-F1-02 | workspace-config | Versiones alineadas de deps compartidas | 1 | MUST |
| REQ-F1-03 | workspace-config | lucide-react versión única | 1 | MUST |
| REQ-F1-04 | workspace-config | turbo.json con pipeline correcta | 1 | MUST |
| REQ-F1-05 | workspace-config | pnpm install sin errores | 1 | MUST |
| REQ-F2-01 | shared-components | AuthProvider usa JWT decode | 2 | MUST |
| REQ-F2-02 | shared-components | AuthContextValue interfaz completa | 2 | MUST |
| REQ-F2-03 | shared-components | nodo-inmo sin copias de UI | 2 | MUST NOT |
| REQ-F2-04 | shared-components | nodo-inmo sin use-auth local | 2 | MUST NOT |
| REQ-F2-05 | shared-components | RequireAuth funciona con nuevo AuthProvider | 2 | MUST |
| REQ-F2-06 | shared-components | nodo-core independiente de AuthProvider shared | 2 | MUST |
| REQ-F2-07 | shared-components | Clientes Supabase independientes | 2 | MUST |
| REQ-F3-01 | module-federation | nodo-inmo expone módulo raíz | 3 | MUST |
| REQ-F3-02 | module-federation | nodo-core consume via next/dynamic | 3 | MUST |
| REQ-F3-03 | module-federation | React singleton compartido | 3 | MUST |
| REQ-F3-04 | module-federation | Hard redirect eliminado | 3 | MUST NOT |
| REQ-F3-05 | module-federation | Ruta pública /inmo/* | 3 | MUST |
| REQ-F3-06 | module-federation | MemoryRouter en remote | 3 | MUST |
| REQ-F3-07 | module-federation | Deploy independiente posible | 3 | MUST |
| REQ-BP-01 | nodo-blueprint | Checklist ≤ 8 pasos documentada | 3 | MUST |
| REQ-BP-02 | nodo-blueprint | Setup < 30 min | 3 | SHOULD |
| REQ-BP-03 | nodo-blueprint | Zero cambios en nodo-core al agregar nodo | 3 | MUST |
