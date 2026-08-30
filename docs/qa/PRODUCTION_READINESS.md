# PRODUCTION READINESS — Nodo Clínica

**Fecha:** 2026-08-29
**Proyecto Supabase:** `iprrlgmhpsxzyrejabtu` (schema `nodo_clinica`)
**Modo de auditoría:** read-only. Verificación adversarial parcial (inline) de los P0/P1.

---

# VEREDICTO: 🔴 NO-GO

**Nodo Clínica NO está listo para ser usado por un médico real en producción.**

Hay **1 P0** (exposición de PII + token de onboarding a usuarios no autenticados) y **12 P1**, varios de ellos con impacto directo en **privacidad de datos clínicos, integridad clínica, dinero e integridad legal de la historia clínica**. El release gate definido en el propio MASTER-PROMPT (P0 abiertos = 0, P1 abiertos = 0) no se cumple.

Además hay un **P1 que roza P0** (`DM-001`): los FKs de datos clínicos son `ON DELETE CASCADE`, de modo que un solo borrado puede eliminar de forma irreversible historia clínica de retención legal obligatoria (Ley 26.529, 10 años).

> Contexto atenuante (no cambia el veredicto): las tablas clínicas hoy tienen **0 filas** — todavía no hay datos reales en riesgo. Eso da una ventana para corregir ANTES del primer paciente. No es una razón para salir; es la razón por la que conviene arreglar ahora.

---

## Release gate (MASTER-PROMPT) — estado

| Criterio | Requerido | Real | Estado |
| -------- | --------- | ---- | ------ |
| P0 abiertos | 0 | **1** | ❌ FAIL |
| P1 abiertos | 0 | **12** | ❌ FAIL |
| Security audit | PASS | 1 P0 + 3 P1 | ❌ FAIL |
| RLS | PASS | frontera real en la API, no en RLS | ⚠️ PARTIAL |
| Cross-user isolation | PASS | IDOR en refunds + atribución clínica | ❌ FAIL |
| Clinical data integrity | PASS | atribución/borrado sin ownership; cascada destructiva | ❌ FAIL |
| Payments | PASS | IDOR refund, webhook fail-open, dup Preapproval | ❌ FAIL |
| Idempotency | PASS | suscripción y reserva no idempotentes | ❌ FAIL |
| Race conditions | PASS | sin unicidad de slot en DB | ❌ FAIL |
| Secrets exposure | PASS | PAT en disco; secreto JWT con fallback | ⚠️ PARTIAL |
| E2E críticos | PASS | no ejecutados | ⏳ NOT TESTED |
| Supabase performance | PASS | sólo P2/P3 | ⚠️ PARTIAL |
| Frontend performance | PASS | no auditado en esta pasada | ⏳ NOT TESTED |
| Load test | PASS | no ejecutado | ⏳ NOT TESTED |
| Backup recovery | PASS | no auditado; DM-002 compromete DR | ⏳ NOT TESTED |

---

## Matriz de dimensiones

| Dimensión | Estado | Nota |
| --------- | ------ | ---- |
| Functional regression | NOT TESTED | No se corrió suite funcional en esta pasada. `CDA-003` sugiere una feature (SOAP) rota en prod. |
| Security | FAIL | SEC-001 (P0) + SEC-002/003/004 (P1) + 6 P2. |
| RLS | PARTIAL | RLS habilitada en todas las tablas; sin fugas cross-tenant a nivel query. PERO la frontera de autorización real vive en la capa API con `service_role` (RLS-05), y ahí están los IDOR (PAY-001, CDA-002). RPC SECURITY DEFINER expuestas a anon (SEC-001/002/010). |
| Clinical integrity | FAIL | CDA-001/002/003 (atribución/borrado sin ownership; SOAP roto) + DM-001 (cascada destructiva). |
| Payments | FAIL | PAY-001 (IDOR refund), PAY-002 (webhook fail-open), IDEM-001 (dup Preapproval). Doble refund SÍ mitigado. |
| Idempotency | FAIL | IDEM-001 (P1) + IDEM-002/003/004 (P2). Confirmación de pago re-consulta MP (bien), pero checkout/reserva no son idempotentes. |
| Concurrency | FAIL | RACE-001 (sin unicidad de slot) + RACE-002/003 (P2). |
| Supabase | PARTIAL | Sin P0/P1 de infra. P2/P3: realtime amplio, over-fetching, índices, políticas duplicadas. |
| Performance (frontend) | NOT TESTED | Pendiente (FRONTEND_PERFORMANCE_AUDIT no generado en esta pasada). |
| Realtime | PARTIAL | Canal de dashboard sin acotar (SUPA-005, P2); no se detectaron leaks P0/P1. |
| Storage | PARTIAL | Buckets no auditados en profundidad; PDFs/documentos referenciados. Pendiente. |
| Error handling | NOT TESTED | ERROR_HANDLING_AUDIT no generado; `CDA-003` insinúa errores silenciosos en escritura. |
| Backups / DR | NOT TESTED | DM-002 (schema no versionado) degrada la capacidad de recuperación. BACKUP_RECOVERY_AUDIT pendiente. |
| Observability | NOT TESTED | OBSERVABILITY_AUDIT pendiente. |
| E2E readiness | NOT TESTED | E2E_MATRIX pendiente. |
| Load testing readiness | NOT TESTED | LOAD_TEST_PLAN pendiente. |

Leyenda: PASS / FAIL / PARTIAL / NOT TESTED.

---

## Condiciones para pasar a CONDITIONAL GO

Mínimo indispensable antes de exponer la app a un médico real (todos verificables):

1. **SEC-001 + SEC-002:** `REVOKE EXECUTE FROM PUBLIC, anon` en las 4 RPC + auth interna. (Cierra el P0.)
2. **DM-001:** eliminar `ON DELETE CASCADE` sobre datos clínicos; soft-delete.
3. **CDA-001 / CDA-002 / PAY-001:** enforcement de ownership (doctor_id del auth) en escritura, borrado clínico y refunds.
4. **SEC-003:** fail-fast del secreto de sesión en prod + no matchear paciente por email.
5. **RACE-001:** unicidad de slot en DB.
6. **CDA-003:** auth + org_id en `/api/soap/generate`.
7. **PAY-002:** firma de webhook obligatoria en prod.
8. **SEC-004:** rotar el PAT de Supabase.
9. **IDEM-001:** dedupe de Preapproval de suscripción.
10. **DM-002:** versionar el schema vivo (paridad migración↔DB) para DR.

Y completar las auditorías **NOT TESTED** (frontend perf, error handling, backups/DR, observability) + los planes de test (E2E, load, chaos, manual) antes de un GO pleno.

---

## Resumen

- **P0 abiertos:** 1
- **P1 abiertos:** 12
- **P2:** 30 · **P3:** 22
- **Verdict:** **NO-GO** → objetivo inmediato: cerrar el P0 y los P1 de seguridad/clínica/pagos/concurrencia para alcanzar **CONDITIONAL GO**.
