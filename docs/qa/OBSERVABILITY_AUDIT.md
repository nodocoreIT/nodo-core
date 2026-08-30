# OBSERVABILITY AUDIT — Nodo Clínica

**Fecha:** 2026-08-29 · **Modo:** read-only. Prioriza privacidad: NO se recomienda loguear PII/PHI clínica.

## Estado actual (evidencia `rg`)

- **Sin agregador de errores:** no hay dependencia de Sentry / Datadog / LogRocket / OpenTelemetry / pino / winston en `src` ni `package.json`.
- **Reporte por consola:** 60 usos de `console.error/warn`. En serverless (Vercel) van a los logs de función, pero sin agregación, alerta ni retención útil.
- **Correlation/request IDs:** sólo en el verificador de webhook de MP (`webhook-verify.ts`, `mercadopago/webhook/route.ts`). No hay request-id transversal.
- **Tabla `audit_logs`:** existe en el schema pero sin uso detectado en `src/` (ver DATA_MODEL DM-009).

## ¿Puedo detectar en producción...?

| Evento | ¿Detectable hoy? | Nota |
| ------ | ---------------- | ---- |
| Frontend crash | ❌ No | Sin error boundary reportando a un backend |
| API failure (5xx) | ⚠️ Parcial | Sólo en logs de Vercel, sin alerta |
| Edge function error | ⚠️ Parcial | No se detectaron edge functions propias; N/A |
| Pago fallido | ❌ No | console.error sin alerta |
| Webhook fallido | ⚠️ Parcial | Hay logs, no alerta ni dead-letter |
| Email fallido | ❌ No | — |
| PDF fallido | ❌ No | — |
| Upload fallido | ❌ No | — |
| Slow query | ❌ No | Sólo advisors de Supabase (bajo demanda) |
| Realtime error | ❌ No | — |

## Hallazgos

```
ID: OBS-001
SEVERIDAD: P2
AREA: Observabilidad / ausencia de monitoreo de errores
ARCHIVO: package.json / src (sin lib de monitoring)
DESCRIPCION: No hay captura centralizada de errores. Un fallo de pago, webhook, PDF, email o upload no produce ninguna señal accionable en producción; el equipo se entera por el usuario.
IMPACTO: MTTR alto; incidentes clínicos/financieros invisibles hasta que un médico/paciente los reporta.
RECOMENDACION: Integrar un agregador (p.ej. Sentry) para excepciones y fallos de rutas críticas (pagos, clínica), configurado para NO capturar PII/PHI (scrubbing).
```

```
ID: OBS-002
SEVERIDAD: P3
AREA: Observabilidad / correlación de requests
ARCHIVO: src (sin request-id transversal)
DESCRIPCION: No hay request/correlation ID propagado entre frontend → API → DB/MP. Diagnosticar un pago o turno específico requiere reconstruir a mano.
IMPACTO: Debugging lento de incidentes financieros/clínicos.
RECOMENDACION: Generar un request-id por operación crítica y loguearlo (sin datos clínicos) en API y webhooks.
```

```
ID: OBS-003
SEVERIDAD: P3
AREA: Observabilidad / auditoría de acciones sensibles
ARCHIVO: nodo_clinica.audit_logs (tabla sin uso en src)
DESCRIPCION: Existe audit_logs pero no se escribe. Acciones críticas (borrado clínico CDA-002, refunds PAY-001, cambios de rol) no dejan traza de auditoría.
IMPACTO: Imposible reconstruir quién borró/reembolsó qué. Relevante para los IDOR reportados.
RECOMENDACION: Escribir audit_logs en borrado clínico, refunds y cambios de rol (actor, acción, entidad, timestamp), sin volcar el contenido clínico.
```
