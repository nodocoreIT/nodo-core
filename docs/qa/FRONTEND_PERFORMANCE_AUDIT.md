# FRONTEND PERFORMANCE AUDIT — Nodo Clínica

**Fecha:** 2026-08-29 · **Modo:** read-only. Foco en lo que genera requests/CPU/memoria/costo, no micro-optimizaciones. Stack: Next.js 16 App Router, React 19, TanStack Query.

## Puntos correctos observados

- TanStack Query con `staleTime: 60_000` y `retry: 1` (`app-providers.tsx:41`) — evita refetch storms por defecto.
- Realtime en dashboard médico y sala de espera con canales dedicados por id (cleanup esperado en el `useEffect` — ver FE-002).
- 0 bloques `catch {}` vacíos (ver ERROR_HANDLING).

## Hallazgos

```
ID: FE-001
SEVERIDAD: P2
AREA: Polling agresivo + realtime redundante
ARCHIVO: src/components/dashboard/doctor-dashboard.tsx:551,558-576
DESCRIPCION: loadQueue con setInterval de 3 s coexiste con canal realtime sobre appointments. 3 s = 20 requests/min por médico activo, sostenidos toda la consulta, además del stream realtime que ya entrega los mismos cambios.
IMPACTO: Costo Supabase (egress + DB) y CPU/red del cliente durante toda la sesión de consultorio.
RECOMENDACION: Eliminar el polling y confiar en realtime, o degradar a fallback de 30-60 s.
```

```
ID: FE-002
SEVERIDAD: P2
AREA: Timers/canales — verificar cleanup para evitar leaks
ARCHIVO: múltiples (rg setInterval / .channel): use-clinic-notifications.ts:71, medico-admin-layout.tsx:210,227, doctor-dashboard.tsx:551,558,572, waiting-room.tsx:479,541,577,589, nodo-chat-widget.tsx:264,277, interconsult-panel.tsx:61
DESCRIPCION: Hay ~12 setInterval y 4 canales realtime. Cada uno debe limpiarse (clearInterval / supabase.removeChannel) en el return del useEffect. Un solo caso sin cleanup en un componente que se monta/desmonta seguido (navegación entre pantallas médicas) acumula timers y suscripciones (memory leak + requests fantasma).
IMPACTO: Memory leak y requests duplicados tras navegación repetida; se agrava con multi-tab.
RECOMENDACION: Auditar uno por uno que cada useEffect con timer/canal retorne su limpieza; agregar test que verifique removeChannel/clearInterval al desmontar.
```

```
ID: FE-003
SEVERIDAD: P3
AREA: Carga inicial — lazy loading de dependencias pesadas
ARCHIVO: src/lib/pdf/* (jspdf), integración Jitsi
DESCRIPCION: jspdf y el cliente de videollamada (Jitsi) son dependencias pesadas. Conviene confirmar que se cargan con dynamic import sólo cuando se usan (emitir PDF / entrar a videoconsulta) y no en el bundle inicial del dashboard.
IMPACTO: Bundle inicial más grande y TTI peor si se importan de forma estática.
RECOMENDACION: `dynamic()`/import() diferido para jspdf y el módulo de videoconsulta.
```

> Nota: FRONTEND_PERFORMANCE se auditó por patrones (timers, realtime, query config). Un profiling real (React DevTools, Lighthouse, bundle analyzer) queda como paso de la fase de test — ver MANUAL_TEST_PLAN / LOAD_TEST_PLAN.
