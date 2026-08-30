# MASTER TEST PLAN — Nodo Clínica

**Fecha:** 2026-08-29 · **Estado del release:** 🔴 NO-GO (1 P0, 12 P1). Ver `PRODUCTION_READINESS.md`.

## 1. Objetivo

Certificar que Nodo Clínica es segura y correcta para uso por un médico real, con foco (en orden): **Seguridad → RLS → Privacidad → Integridad clínica → Pagos → Turnos/Concurrencia → Idempotencia → Persistencia → Supabase → Realtime → Performance → Error handling → UX.**

## 2. Alcance

- App `nodo-clinica` (Next.js 16 / Supabase), portales Médico y Paciente.
- Backend: Supabase (Postgres `nodo_clinica`, Auth, Storage, Realtime), MercadoPago, Gemini, Jitsi, emails, PDF.
- Fuera de alcance directo: otros nodos del monorepo (salvo tablas compartidas `shared`/`nodo_core`).

## 3. Niveles de test y documentos

| Nivel | Documento | Estado |
| ----- | --------- | ------ |
| Arquitectura | ARCHITECTURE_MAP.md | ✅ |
| Modelo de datos | DATA_MODEL_AUDIT.md | ✅ |
| Seguridad | SECURITY_AUDIT.md | ✅ |
| RLS | RLS_MATRIX.md | ✅ |
| Integridad clínica | CLINICAL_DATA_AUDIT.md | ✅ |
| Pagos | PAYMENT_AUDIT.md | ✅ |
| Concurrencia | RACE_CONDITIONS.md | ✅ |
| Idempotencia | IDEMPOTENCY_AUDIT.md | ✅ |
| Supabase infra | SUPABASE_AUDIT.md | ✅ |
| Mapa de red | NETWORK_REQUEST_MAP.md | ✅ |
| Frontend perf | FRONTEND_PERFORMANCE_AUDIT.md | ✅ |
| Error handling | ERROR_HANDLING_AUDIT.md | ✅ |
| Observabilidad | OBSERVABILITY_AUDIT.md | ✅ |
| Backups/DR | BACKUP_RECOVERY_AUDIT.md | ✅ (parcial: PITR a confirmar) |
| Chaos | CHAOS_TEST_PLAN.md | ✅ (plan) |
| E2E | E2E_MATRIX.md | ✅ (diseño) |
| Load | LOAD_TEST_PLAN.md | ✅ (plan) |
| Manual | MANUAL_TEST_PLAN.md | ✅ (plan) |
| Consolidado | BUG_REPORT / RISK_REGISTER / PRODUCTION_READINESS | ✅ |

## 4. Entornos y datos

- **No testear contra producción.** Usar branch/proyecto de staging de Supabase con datos sintéticos.
- Usuarios de prueba: ver `E2E_MATRIX.md` (MEDICO_A/B, PACIENTE_A/B/FREE/PAGO, ADMIN).
- MercadoPago en modo sandbox; Gemini con cuota de test; Jitsi de test.

## 5. Criterios de entrada / salida

**Entrada a fase de test formal:** P0 cerrado + los P1 de seguridad/clínica/pagos/concurrencia corregidos (el resto de la app cambia de comportamiento tras esos fixes).

**Salida (Release Gate, del MASTER-PROMPT):**
- P0 abiertos: 0 · P1 abiertos: 0
- Security, RLS, Cross-user isolation, Clinical integrity, Payments, Idempotency, Race conditions: PASS
- E2E críticos (P0/P1 de la matriz): PASS
- Backup recovery probado (restore real medido): PASS
- 0 excepciones no manejadas críticas · 0 5xx en flujos normales

## 6. Estrategia de ejecución (roadmap)

1. **Fix wave 1 (P0 + P1):** cerrar SEC-001/002, DM-001, CDA-001/002/003, PAY-001/002, SEC-003, RACE-001, SEC-004, IDEM-001, DM-002.
2. **Regresión de seguridad/autorización:** correr E3-E8, E10, E15-E17 (deben pasar tras los fixes).
3. **E2E happy + unhappy:** resto de la matriz.
4. **Idempotencia/concurrencia:** E10, E11, E14, E16, E17 + chaos C7-C10, C15.
5. **Completar NOT TESTED:** confirmar PITR/backups (restore de prueba), integrar observabilidad, profiling frontend.
6. **Load test** en staging con sesiones médicas sostenidas (modelar FE-001).
7. **Manual QA** cross-browser + iOS dictado.
8. **Re-evaluar PRODUCTION_READINESS** → objetivo CONDITIONAL GO, luego GO.

## 7. Métricas de calidad

- Cobertura de los casos P0/P1 de `E2E_MATRIX.md`: 100%.
- Hallazgos P0/P1 reabiertos: 0.
- SLOs de `LOAD_TEST_PLAN.md` cumplidos.
