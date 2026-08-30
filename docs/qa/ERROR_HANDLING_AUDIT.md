# ERROR HANDLING AUDIT — Nodo Clínica

**Fecha:** 2026-08-29 · **Modo:** read-only.

## Panorama (evidencia `rg` sobre `src/`)

- **`catch {}` vacíos: 0.** No se detectaron bloques catch completamente vacíos. Buen indicador base.
- **`const { data } = await ...` sin desestructurar `error`: 9 ocurrencias.** Potenciales errores ignorados — requieren revisión caso por caso (no todos son llamadas Supabase con error relevante).
- **`console.error/warn`: 60 ocurrencias.** El manejo de errores se apoya fuertemente en consola (ver OBSERVABILITY: sin agregador → estos logs no son visibles en prod).

## Hallazgos

```
ID: ERR-001
SEVERIDAD: P2
AREA: Errores potencialmente ignorados en llamadas Supabase
ARCHIVO: 9 sitios con `const { data } = await ...` (rg) — revisar cuáles son .from()/.rpc()
DESCRIPCION: En 9 puntos se desestructura sólo `data` sin `error`. En rutas de escritura (pagos, clínica, turnos) omitir `error` significa que un fallo de Supabase pasa como éxito silencioso (data=null) → pérdida de dato sin feedback.
IMPACTO: Escrituras que fallan sin avisar; estado UI inconsistente con la DB.
RECOMENDACION: Revisar los 9 sitios; en escritura, siempre chequear `error` y propagarlo a la UI.
```

```
ID: ERR-002
SEVERIDAD: P2
AREA: Errores sólo por consola, invisibles en producción
ARCHIVO: 60 usos de console.error/warn en src/
DESCRIPCION: El grueso del reporte de errores es console.error. Sin un agregador (Sentry/Datadog — ver OBSERVABILITY), estos errores no se capturan en producción: un fallo de pago/PDF/upload no genera ninguna señal accionable.
IMPACTO: Fallos silenciosos en producción; imposible detectar/priorizar incidentes.
RECOMENDACION: Enrutar errores a un agregador (sin PII clínica) además de la consola.
```

```
ID: ERR-003
SEVERIDAD: P2
AREA: Persistencia parcial en operaciones multi-paso (referencia)
ARCHIVO: ver CLINICAL_DATA_AUDIT (CDA-003/004/005) y appointment-refund.ts
DESCRIPCION: Varias operaciones son secuencias de awaits independientes sin transacción; un error a mitad deja estado parcial. appointment-refund.ts maneja el fallo de refund marcando refund_failed (correcto), pero otras (SOAP CDA-003, receta CDA-004) no tienen ese cuidado.
IMPACTO: Registros huérfanos / features rotas silenciosamente (CDA-003).
RECOMENDACION: Atomicidad (RPC transaccional) o compensación explícita + estado de error visible.
```

## Buenas prácticas observadas

- `appointment-refund.ts:58-72`: ante fallo del refund en MP, marca `refund_failed` con nota y comenta que el reintento es seguro por `X-Idempotency-Key`. Manejo de error correcto y explícito.
- Rutas API devuelven status codes y mensajes de error consistentes (400/401/403/404/500) en la mayoría de los endpoints revisados.
