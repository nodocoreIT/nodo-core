# NETWORK REQUEST MAP — Nodo Clínica

**Fecha:** 2026-08-29 · **Modo:** read-only. Mapa de requests por pantalla (polling, realtime, queries). Evidencia por `rg` sobre `src/`.

## Resumen de mecanismos activos

- **TanStack Query:** `staleTime: 60_000`, `retry: 1` (`app-providers.tsx:41`).
- **Polling (`setInterval`):** ver tabla — coexiste con Realtime en varias pantallas.
- **Realtime (`postgres_changes`):** 4 canales (dashboard médico ×2, sala de espera ×2).

## Polling activo (fuente: `rg setInterval`)

| Intervalo | Dónde | Qué refresca |
| --------- | ----- | ------------ |
| **3 s** | `doctor-dashboard.tsx:551` `loadQueue` | Cola de espera del consultorio (⚠️ además hay canal realtime sobre appointments) |
| 10 s | `medico-admin-layout.tsx:210` | Contador de cobros no leídos |
| 10 s | `nodo-chat-widget.tsx:277` | Mensajes de chat |
| 20 s | `nodo-chat-bell.tsx:58` | Badge de chat |
| 30 s | `use-medico-home-agenda.ts:98` | Agenda del home médico |
| 30 s | `medico-admin-layout.tsx:227` | Ping de presencia interconsulta |
| 60 s | `use-clinic-notifications.ts:71` | Notificaciones |
| 180 s | `doctor-pending-payments-panel.tsx:59`, `doctor-payments-ledger.tsx:57`, `doctor-cobros-list.tsx:201` | Cobros/pagos |
| varios | `waiting-room.tsx:479,577` | Sala de espera (polling + realtime) |

## Realtime (fuente: `rg .channel/postgres_changes`)

| Canal | Dónde | Tabla |
| ----- | ----- | ----- |
| `doctor-appointments` | `doctor-dashboard.tsx:558` | appointments |
| `doctor-documents-${doctorId}` | `doctor-dashboard.tsx:572` | patient_documents |
| `waiting-${accessToken}` | `waiting-room.tsx:541` | appointments |
| `clinical-records-${appointment.id}` | `waiting-room.tsx:589` | clinical_records |

## Mapa por ruta (principales)

| Ruta | Request inicial | Secundarias / polling | Realtime | Observación |
| ---- | --------------- | --------------------- | -------- | ----------- |
| `/medico/dashboard` | agenda + tareas + stats | agenda 30 s, notificaciones 60 s, cobros 10 s (layout), presencia 30 s (layout) | — | Layout médico agrega polling en TODA pantalla médica |
| `/medico/consultorio` (doctor-dashboard) | cola de espera | **loadQueue 3 s** | `doctor-appointments`, `doctor-documents` | **Polling 3 s + realtime redundante** sobre appointments (ver FRONTEND_PERFORMANCE / SUPA-005) |
| `/medico/cobros` | ledger de pagos | 180 s ×3 paneles | — | 3 intervalos de 180 s en paralelo |
| `/medico/interconsultas` | directorio + mensajes | presencia 30 s, chat 10-20 s | — | Varios timers de chat |
| `/paciente/sala` (waiting-room) | estado del turno | polling + | `waiting-*`, `clinical-records-*` | Polling y realtime simultáneos |
| `/pedir-turno` | doctores + especialidades + horarios | on-demand | — | Sin unicidad de slot en DB (RACE-001) |

## Hallazgos

```
ID: NET-001
SEVERIDAD: P2
AREA: Red / Realtime + polling redundante
ARCHIVO: src/components/dashboard/doctor-dashboard.tsx:551,558
DESCRIPCION: La cola del consultorio se refresca por polling cada 3 s (setInterval loadQueue) Y por un canal realtime postgres_changes sobre appointments. Los dos mecanismos hacen el mismo trabajo; el polling de 3 s por sesión médica activa genera 20 req/min sostenidos por médico.
IMPACTO: Requests y egress Supabase innecesarios durante toda la sesión de consultorio; se agrava con varios médicos.
RECOMENDACION: Dejar sólo realtime (o subir el intervalo de fallback a 30-60 s). Ver SUPA-005.
```

```
ID: NET-002
SEVERIDAD: P3
AREA: Red / Polling agregado del layout médico
ARCHIVO: src/components/layout/medico-admin-layout.tsx:210,227
DESCRIPCION: El layout médico monta polling de cobros (10 s) y presencia (30 s) que corre en CUALQUIER pantalla médica, sume o no la funcionalidad visible.
IMPACTO: Costo de sesión activa constante independientemente de la vista.
RECOMENDACION: Montar el polling sólo donde la data se muestra; considerar realtime para el badge de cobros.
```
