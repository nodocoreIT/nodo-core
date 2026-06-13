# Proposal: Refactor Arquitectura Microfrontends — nodocore

## Intent

El monorepo nodocore tiene 3 paquetes (nodo-core, nodo-inmo, shared-components) que NO funcionan como monorepo real: no estan en `pnpm-workspace.yaml`, nodo-inmo tiene 7+ copias locales de componentes compartidos, el contrato de auth diverge entre apps, y la "integracion" actual es un hard redirect. Este refactor establece la arquitectura MFE real: monorepo funcional, contrato de auth unificado, y Module Federation para composicion client-side. Sin esto, cada nuevo nodo multiplica deuda tecnica y duplicacion.

## Scope

### In Scope
- Corregir `pnpm-workspace.yaml` para incluir nodo-core y nodo-inmo
- Unificar contrato de auth en shared-components (JWT decode como fuente de verdad)
- Eliminar copias locales de UI en nodo-inmo, consumir `@nodocore/shared-components`
- Configurar Module Federation: nodo-core como Host (Next.js), nodo-inmo como Remote (Vite)
- Renderizado client-side via `next/dynamic(() => import('remote/...'), { ssr: false })`
- Blueprint documentado para agregar futuros nodos remotos

### Out of Scope
- Migrar nodo-core de Next.js a Vite
- nodo-clinica (demo, fuera de scope)
- SSR de remotes (complejidad injustificada con stack mixto)
- Redesign de UI components existentes
- Cambios en API routes o server actions de nodo-core

## Capabilities

### New Capabilities
- `module-federation`: Configuracion MFE host/remote con Module Federation
- `nodo-blueprint`: Contrato y guia para enchufar nuevos nodos remotos

### Modified Capabilities
- `shared-components`: Auth contract cambia de `app_metadata` a JWT decode; nodo-inmo pasa a consumirlos
- `workspace-config`: pnpm-workspace.yaml corregido para incluir todos los paquetes

## Approach

**Fase 1 — Fundacion del monorepo** (prerequisito de todo lo demas):
Corregir `pnpm-workspace.yaml`, verificar resoluciones de dependencias cruzadas, alinear versiones de React 19 y Tailwind v4 entre paquetes.

**Fase 2 — Contrato de auth unificado y shared-components**:
Migrar AuthProvider en shared-components al enfoque JWT decode (que nodo-inmo ya usa correctamente). Eliminar copias locales en nodo-inmo, reemplazar con imports de `@nodocore/shared-components`. Verificar que nodo-core sigue funcionando con el nuevo contrato.

**Fase 3 — Module Federation**:
Configurar `@module-federation/nextjs-mf` en nodo-core (host) y `@originjs/vite-plugin-federation` (o `@module-federation/vite`) en nodo-inmo (remote). Reemplazar hard redirect por carga dinamica client-side. Definir convenciones de expose/consume para futuros nodos.

**Criterio de enchufabilidad** — agregar un nuevo nodo requiere:
1. Crear app Vite con plugin federation, exponer modulos
2. Registrar remote en config del host (nodo-core)
3. Consumir shared-components y auth contract existentes
4. Zero cambios en el shell mas alla del registro

## Affected Areas

| Area | Impacto | Descripcion |
|------|---------|-------------|
| `pnpm-workspace.yaml` | Modified | Agregar nodo-core y nodo-inmo |
| `packages/shared-components/` | Modified | Auth contract → JWT decode |
| `apps/nodo-inmo/` | Modified | Consumir shared-components, config federation remote |
| `apps/nodo-landing/` | Modified | Config federation host, reemplazar redirect por dynamic import |
| `docs/` o `openspec/` | New | Blueprint para nuevos nodos |

## Risks

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|------------|
| Incompatibilidad Module Federation Next.js 16 + Vite 6 | Media | Spike tecnico en Fase 3 antes de implementar; evaluar `@module-federation/vite` como alternativa |
| Shared dependencies version mismatch (React, Tailwind) | Baja | Fase 1 alinea versiones antes de integrar |
| Breaking change en auth contract afecta nodo-core | Baja | Tests de auth en ambas apps antes de mergear Fase 2 |
| Performance de carga client-side de remotes | Baja | Lazy loading con suspense boundaries; medir con Lighthouse |

## Rollback Plan

Cada fase es un PR independiente y autonomo:
- **Fase 1**: revert del `pnpm-workspace.yaml` — zero impacto funcional
- **Fase 2**: revert de shared-components auth + restaurar copias locales en nodo-inmo (copias existen en git history)
- **Fase 3**: revert de config MFE + restaurar hard redirect — la app vuelve al estado actual sin degradacion

## Dependencies

- `@module-federation/nextjs-mf` compatible con Next.js 16 (verificar en Fase 3 spike)
- Plugin federation Vite compatible con Vite 6
- pnpm workspace protocol para cross-package resolution

## Success Criteria

- [ ] `pnpm install` resuelve todas las dependencias cruzadas sin errores
- [ ] nodo-inmo importa componentes de `@nodocore/shared-components` (zero copias locales)
- [ ] Auth funciona identico en ambas apps con un unico AuthProvider (JWT decode)
- [ ] nodo-inmo se renderiza dentro de nodo-core via Module Federation (sin redirect)
- [ ] Existe blueprint documentado: agregar un nuevo nodo toma < 30 min de setup
- [ ] Zero regresiones en funcionalidad existente de ambas apps
