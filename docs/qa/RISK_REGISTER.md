# RISK REGISTER — Nodo Clínica

**Fecha:** 2026-08-29 · **Modo:** read-only · Riesgos agregados a partir de los hallazgos verificados (ver `BUG_REPORT.md` y los audits por dominio).

Probabilidad e Impacto en escala Alta / Media / Baja.

| # | Riesgo | Probabilidad | Impacto | Severidad | Evidencia | Mitigación |
| - | ------ | ------------ | ------- | --------- | --------- | ---------- |
| R1 | Usuario no autenticado extrae email + onboarding_token de todas las registraciones pendientes → toma de cuenta | Alta | Alto | **P0** | SEC-001; `has_function_privilege('anon',...)`=true en 4 RPC SECURITY DEFINER | `REVOKE EXECUTE FROM PUBLIC, anon` + auth interna + no devolver el token |
| R2 | Borrado (accidental o en cascada) elimina historia clínica de retención legal, irreversible | Media | Alto | **P1** | DM-001; FKs `ON DELETE CASCADE` (pg_get_constraintdef) | Quitar cascada sobre datos clínicos; `RESTRICT`/`SET NULL` + soft-delete |
| R3 | Impersonación de paciente/médico por forja de JWT de sesión | Media | Alto | **P1** | SEC-003; fallback hardcodeado en `session.ts:26-32`; match por email `:97` | Fail-fast del secreto en prod; no matchear por email |
| R4 | Corrupción de autoría clínica: receta/registro/estudio atribuido al médico o paciente equivocado | Media | Alto | **P1** | CDA-001; `prescriptions/route.ts:79,124-129` (doctorId del body) | Forzar doctor_id del auth; validar médico↔paciente |
| R5 | Borrado no autorizado de historia clínica ajena por cualquier médico del org | Media | Alto | **P1** | CDA-002; DELETE con service client sólo por id+org | Ownership check; soft-delete + audit |
| R6 | IDOR de reembolsos: un médico reembolsa turnos de otro (movimiento de dinero ajeno) | Media | Alto | **P1** | PAY-001; `appointments/route.ts:1600-1620` sin `.eq(doctor_id)` | Exigir `apt.doctor_id === professional del auth` |
| R7 | Turnos duplicados / doble reserva del mismo slot bajo concurrencia | Alta | Medio | **P1** | RACE-001; `appointments` sin UNIQUE de slot (pg_constraint) | UNIQUE/EXCLUDE (professional, fecha, hora) en estados activos |
| R8 | Feature SOAP rota + endpoint de IA sin auth (pérdida de dato clínico + abuso/costo Gemini) | Alta | Medio | **P1** | CDA-003; `soap/generate/route.ts` sin auth y sin org_id (NOT NULL) | requireAuth + org_id + ownership del appointment |
| R9 | Webhook MP procesado sin firma si falta la env var (replay/sondeo) | Media | Medio | **P1** | PAY-002/SEC-005; `webhook/route.ts:52-64` fail-open | Firma obligatoria en prod (rechazar si falta secret) |
| R10 | Doble cobro recurrente "fantasma" al médico en el checkout de suscripción | Media | Alto | **P1** | IDEM-001; `subscription/checkout/route.ts:44-92` crea Preapproval en cada llamada | Dedupe/cancelar Preapproval previo; idempotency key |
| R11 | Fuga del PAT de Supabase (admin de cuenta) por disco/backup | Baja | Alto | **P1** | SEC-004; `.mcp.json:8-11` token en claro (gitignoreado) | Rotar PAT; pasarlo por env, no argv |
| R12 | Imposibilidad de reconstruir/recuperar la DB (DR) por schema no versionado | Media | Alto | **P1** | DM-002; migración declara tablas base aplicadas a mano | `supabase db pull`; paridad migración↔DB como gate |
| R13 | Toma de acciones sensibles sin autenticación (`ensure-role`) / enumeración + brute force | Media | Medio | **P2** | SEC-006, SEC-008 | Auth en endpoints; rate-limiting; respuestas uniformes |
| R14 | Tokens OAuth de MP en texto plano en DB → cobro en nombre del médico si se filtra la DB | Baja | Alto | **P2** | SEC-007 | Cifrado en reposo (pgsodium/Vault) |
| R15 | Auto-aprobación de comprobante de transferencia por el propio pagador | Media | Medio | **P2** | PAY-004 | Aprobación por el médico, no por el pagador |
| R16 | Superficie amplia de funciones SECURITY DEFINER invocables por anon/authenticated | Media | Medio | **P2** | SEC-010; advisors (32+21 funciones) | `REVOKE FROM PUBLIC/anon`; `SECURITY INVOKER` donde aplique |
| R17 | Persistencia parcial en operaciones clínicas multi-paso (registro sin PDF, etc.) | Media | Medio | **P2** | CDA-004/005/007 | Transaccionalidad/atomicidad o reconciliación |
| R18 | Costo/consumo Supabase: realtime amplio, over-fetching, listas sin paginar, polling | Media | Bajo | **P2/P3** | SUPA-004/005/006/007 | Acotar canales, paginar, `select` de columnas, ajustar polling |
| R19 | Ausencia de observabilidad para detectar pagos/webhooks/PDF/upload fallidos | Media | Medio | **NOT TESTED** | OBSERVABILITY_AUDIT pendiente | Error monitoring + correlation IDs (sin PII clínica) |
| R20 | Sin plan de backup/recovery verificado para DB y Storage | Media | Alto | **NOT TESTED** | BACKUP_RECOVERY_AUDIT pendiente | Confirmar PITR + estrategia de Storage; probar restore |

## Top 5 a mitigar YA (antes del primer paciente)

1. **R1 (P0)** — RPC públicas.
2. **R2 (P1)** — cascada destructiva sobre historia clínica.
3. **R4/R5/R6 (P1)** — ownership en escritura, borrado clínico y refunds.
4. **R3 (P1)** — secreto de sesión.
5. **R7 (P1)** — unicidad de turnos.
