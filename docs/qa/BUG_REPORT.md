# BUG REPORT — Nodo Clínica (Auditoría de Producción)

**Fecha:** 2026-08-29
**Alcance:** app `nodo-clinica` (Next.js 16 / Supabase) + proyecto Supabase `iprrlgmhpsxzyrejabtu`, schema `nodo_clinica`.
**Modo:** read-only. No se modificó código, migraciones, DB, RLS ni configuración.
**Fuente:** consolida los hallazgos de los audits por dominio en `docs/qa/` (SECURITY, RLS, DATA_MODEL, CLINICAL_DATA, PAYMENT, RACE_CONDITIONS, IDEMPOTENCY, SUPABASE). El detalle extendido de cada hallazgo vive en su documento de origen.

---

## Conteo por severidad

| Severidad | Cantidad |
| --------- | -------- |
| **P0 — Blocker** | **1** |
| **P1 — Critical** | **12** |
| **P2 — Major** | **30** |
| **P3 — Minor** | **22** |
| **Total** | **65** |

> Nota de deduplicación: varios IDs describen la MISMA raíz desde distintos dominios. Los conteos los mantienen separados por trazabilidad, pero al corregir se resuelven juntos:
> - **Reserva de turno sin unicidad DB:** `RACE-001` (P1) ≈ `IDEM-003` (P2) ≈ `CDA-008` (P3) ≈ `DM-005` (P2).
> - **Webhook MP fail-open:** `PAY-002` (P1) = `SEC-005` (P2) (mismo archivo/líneas).
> - **Atribución/duplicación de receta y estudio:** `CDA-001` (P1) ≈ `IDEM-004` (P2) ≈ `CDA-004/005` (P2).
> - **Funciones SECURITY DEFINER expuestas a anon:** `SEC-001/002` (P0/P1) ⊂ `SEC-010` (P2) ⊂ `RLS-04`/`SEC-011` (P3).

## Estado de verificación

Verificación adversarial de esta pasada (inline, contra código real y DB en vivo):

| Verdict | Significado |
| ------- | ----------- |
| **CONFIRMED** | Reproducido con evidencia dura en esta pasada (query a la DB o lectura directa del archivo/línea). |
| **PLAUSIBLE** | Evidencia sólida citada en el doc de origen; no re-ejecutado independientemente en esta pasada. |

| Hallazgo | Verdict | Cómo se verificó |
| -------- | ------- | ---------------- |
| SEC-001 (P0) | **CONFIRMED** | `has_function_privilege('anon', ...)` = **true** para las 4 funciones (existen en `public` y `nodo_core`), todas `SECURITY DEFINER`. |
| SEC-002 (P1) | **CONFIRMED** | Misma query; `anon` puede ejecutar el DELETE. |
| SEC-003 (P1) | **CONFIRMED** | `session.ts:26-32` fallback hardcodeado; `:97` match de paciente por email. |
| SEC-004 (P1) | **CONFIRMED** | PAT `sbp_****` en texto plano en `.mcp.json` (gitignoreado). |
| CDA-001 (P1) | **CONFIRMED** | `prescriptions/route.ts:79,124-129` — `doctorId` del body, sólo validado contra org; el GET (`:41`) sí valida ownership. |
| PAY-001 (P1) | **CONFIRMED** | `appointments/route.ts:1600-1620` sólo chequea `role==="patient"`; el DELETE (`:1575`) sí hace `.eq("doctor_id", me.id)`. |
| RACE-001 (P1) | **CONFIRMED** | `pg_constraint`: `appointments` sólo tiene UNIQUE en `id` y `access_token`. No hay unicidad de slot. |
| DM-001 (P1) | **CONFIRMED** | `pg_get_constraintdef`: FKs de datos clínicos con `ON DELETE CASCADE`. |
| DM-002 (P1) | PLAUSIBLE | Comentario de la migración `20260829_prescriptions_standalone.sql`. |
| CDA-002 (P1) | PLAUSIBLE | `clinical-records/route.ts:129-159` (evidencia citada). |
| CDA-003 (P1) | PLAUSIBLE | `soap/generate/route.ts:6-55` + `org_id NOT NULL`; corroborado por 0 filas en la tabla. |
| PAY-002 (P1) | PLAUSIBLE | `mercadopago/webhook/route.ts:52-64`; impacto acotado (el handler re-consulta MP, no se puede fabricar un pago). |
| IDEM-001 (P1) | PLAUSIBLE | `subscription/checkout/route.ts:44-92`. |

---

# P0 — BLOCKERS

```
ID: SEC-001
SEVERIDAD: P0
AREA: Autorización / Exposición de datos (RPC público SECURITY DEFINER)
ARCHIVO: supabase/migrations/20260713_patients_profile_columns.sql (líneas 41-68); función viva en nodo_clinica/public/nodo_core
LINEA: 41-68
VERDICT: CONFIRMED
DESCRIPCION: public.admin_get_clinic_registrations() (y su copia en nodo_core) es SECURITY DEFINER, no tiene ninguna verificación interna de autorización, y devuelve email + role + onboarding_token + expires_at de TODAS las registraciones pendientes. La migración hace GRANT EXECUTE TO authenticated pero NUNCA hace REVOKE FROM PUBLIC → el rol anon conserva EXECUTE por defecto.
EVIDENCIA:
  -- Query en vivo sobre iprrlgmhpsxzyrejabtu:
  -- admin_get_clinic_registrations | security_definer=true | anon_can_execute=TRUE (public y nodo_core)
  CREATE OR REPLACE FUNCTION public.admin_get_clinic_registrations()
    RETURNS TABLE (id, email, role, verified_at, onboarding_token, expires_at, created_at)
    LANGUAGE sql SECURITY DEFINER SET search_path = nodo_clinica, public AS $$ SELECT ... $$;
  GRANT EXECUTE ON FUNCTION ... TO authenticated;  -- sin REVOKE FROM PUBLIC
ESCENARIO PARA REPRODUCIR: Sin sesión, POST https://<proyecto>.supabase.co/rest/v1/rpc/admin_get_clinic_registrations con apikey=anon_key → devuelve todas las registraciones pendientes con su onboarding_token.
IMPACTO: Fuga de PII (emails) y — crítico — del onboarding_token de cuentas aún no activadas, sin autenticación. Ese token habilita el flujo de activación → toma de cuenta (account takeover) de médicos/pacientes en alta.
PROBABILIDAD: alta
RECOMENDACION: REVOKE EXECUTE ... FROM PUBLIC, anon en las 4 variantes; verificación de rol admin dentro de la función; dejar de devolver onboarding_token en cualquier listado. (No implementar en esta fase.)
```

---

# P1 — CRITICAL

```
ID: SEC-002
SEVERIDAD: P1
AREA: Autorización / Integridad (RPC público destructivo)
ARCHIVO: supabase/migrations/20260713_patients_profile_columns.sql:72-81
VERDICT: CONFIRMED (anon_can_execute=true en vivo)
DESCRIPCION: public.admin_delete_clinic_registration(uuid) es SECURITY DEFINER, hace DELETE incondicional sin autorización; GRANT TO authenticated sin REVOKE FROM PUBLIC. Ejecutable por anon.
IMPACTO: Cualquiera (incl. anon) borra registraciones pendientes → DoS del onboarding. Combinado con SEC-001 (expone los ids), el borrado es dirigible.
RECOMENDACION: REVOKE FROM PUBLIC/anon + chequeo de rol admin interno.
```

```
ID: SEC-003
SEVERIDAD: P1 (P0 efectivo si falta la env var en prod)
AREA: Autenticación / Gestión de secretos (JWT de sesión)
ARCHIVO: src/lib/clinic/session.ts:26-32, 93-98
VERDICT: CONFIRMED
DESCRIPCION: El secreto de firma del JWT de sesión (cookie clinica_session, HS256) cae a un valor hardcodeado ("clinica-dev-session-secret-change-in-prod") si faltan CLINIC_SESSION_SECRET/CLINIC_ADMIN_SECRET, sin fail-fast. Además validateSessionUser matchea al paciente por email (.or(profile_id.eq...,email.eq...)).
EVIDENCIA: raw = process.env.CLINIC_SESSION_SECRET || process.env.CLINIC_ADMIN_SECRET || "clinica-dev-session-secret-change-in-prod";
ESCENARIO: Si prod omite ambas env vars, un atacante forja {role:"patient", email:"<víctima>"} con el secreto por defecto y accede a los datos clínicos del paciente cuyo email conoce.
IMPACTO: Forja de sesión → impersonación de pacientes (y médicos). Acceso cross-user a datos clínicos.
RECOMENDACION: Fail-fast en producción si el secreto no está definido; eliminar el fallback; no matchear pacientes por email.
```

```
ID: SEC-004
SEVERIDAD: P1
AREA: Gestión de secretos (token vivo en disco)
ARCHIVO: /Users/ramirotule/Documents/1.Proyectos/nodocore/.mcp.json:8-11
VERDICT: CONFIRMED
DESCRIPCION: PAT de Supabase (sbp_****REDACTED) en texto plano, pasado por argv al MCP server. Token vivo con scope de administración de cuenta. Gitignoreado (git check-ignore => IS_IGNORED) pero en disco en claro.
IMPACTO: Permite listar/gestionar proyectos, aplicar migraciones y leer datos vía API de management si el disco/backup se filtra.
RECOMENDACION: Rotar el PAT (fue visto durante la auditoría) y pasarlo por variable de entorno en vez de argv.
```

```
ID: DM-001
SEVERIDAD: P1 (roza P0 — pérdida irreversible de datos clínicos)
AREA: Integridad de datos / Retención legal
ARCHIVO: FKs de nodo_clinica.appointments/clinical_records/prescriptions/study_orders/... (DB)
VERDICT: CONFIRMED (pg_get_constraintdef en vivo)
DESCRIPCION: El borrado de un professional / patient / organization dispara ON DELETE CASCADE que elimina permanentemente historia clínica, recetas, órdenes de estudio, transcripciones y SOAP. En Argentina la historia clínica debe conservarse mínimo 10 años (Ley 26.529).
EVIDENCIA:
  appointments_doctor_id_fkey:      FK (doctor_id)  REFERENCES professionals(id) ON DELETE CASCADE
  clinical_records_patient_id_fkey: FK (patient_id) REFERENCES patients(id)      ON DELETE CASCADE
  prescriptions_doctor_id_fkey:     FK (doctor_id)  REFERENCES professionals(id) ON DELETE CASCADE
ESCENARIO: Un DELETE de un professional (por error de operación o cascada desde organizations) borra toda la documentación clínica asociada, sin papelera.
IMPACTO: Pérdida irreversible de documentación médica de retención obligatoria. Incumplimiento legal.
RECOMENDACION: Cambiar a ON DELETE RESTRICT / SET NULL + soft-delete en entidades con datos clínicos; nunca cascada destructiva sobre historia clínica.
```

```
ID: DM-002
SEVERIDAD: P1
AREA: Gobernanza de esquema / Reproducibilidad / DR
ARCHIVO: supabase/migrations/20260829_prescriptions_standalone.sql:6-13
VERDICT: PLAUSIBLE
DESCRIPCION: Tablas centrales de nodo_clinica (prescriptions base, patient_documents base, clinical_records, medical_records, patient_health_profiles, doctor_notifications, doctor_presence, doctor_tasks, ...) NO tienen CREATE TABLE rastreable en migrations/; se aplicaron a mano contra Supabase. La carpeta de migraciones no puede reconstruir la DB desde cero; no hay paridad migración↔DB.
IMPACTO: DR y reproducibilidad comprometidas: no se puede recrear un entorno limpio ni auditar el schema desde el repo. Riesgo directo para recuperación ante desastre.
RECOMENDACION: Volcar el schema vivo a migraciones (supabase db pull) y versionarlo; establecer paridad migración↔DB como gate.
```

```
ID: CDA-001
SEVERIDAD: P1
AREA: Integridad clínica / atribución de autoría
ARCHIVO: src/app/api/clinic/prescriptions/route.ts:79,124-129 (+ clinical-records/route.ts, clinic/study-orders/route.ts)
VERDICT: CONFIRMED
DESCRIPCION: doctorId (y patientId) vienen del body y sólo se validan como "existe en el org"; NO se verifica que doctorId sea el médico autenticado ni que el paciente esté asignado. La RLS staff_insert_* sólo chequea org_id. El GET del mismo archivo (línea 41) SÍ valida ownership y devuelve 403 — la inconsistencia confirma el gap.
IMPACTO: Un médico A puede emitir recetas / registros / órdenes atribuidas a otro médico B (o a pacientes no suyos) del mismo org. Corrupción de autoría clínica.
RECOMENDACION: Forzar doctor_id = professional del auth (ignorar el del body); validar relación médico↔paciente antes de escribir.
```

```
ID: CDA-002
SEVERIDAD: P1
AREA: Pérdida de datos clínicos / borrado no autorizado
ARCHIVO: src/app/api/clinic/clinical-records/route.ts:129-159
VERDICT: PLAUSIBLE
DESCRIPCION: El DELETE de un registro clínico usa el service client (bypass total de RLS), con scope sólo por id + org_id y gate único user.role === "doctor". No verifica que el registro sea del médico ni de un paciente suyo.
IMPACTO: Cualquier médico del org borra permanentemente historia clínica ajena conociendo su id. Sin papelera ni auditoría del borrado.
RECOMENDACION: No usar service client para DELETE de médico; exigir doctor_id propio + paciente asignado; soft-delete + audit_logs.
```

```
ID: CDA-003
SEVERIDAD: P1
AREA: Persistencia / atomicidad / auth
ARCHIVO: src/app/api/soap/generate/route.ts:6-55
VERDICT: PLAUSIBLE (corroborado por 0 filas en soap_summaries)
DESCRIPCION: La ruta (a) NO tiene requireAuth y (b) hace upsert en soap_summaries SIN setear org_id. Como org_id es NOT NULL sin default, todo INSERT de un SOAP nuevo viola la restricción → el resumen (computado en Gemini) nunca persiste. Tampoco valida propiedad del appointment.
IMPACTO: Pérdida del SOAP (dato clínico) + endpoint de IA sin auth (abuso/costo de Gemini, PHI a caller anónimo). Feature efectivamente rota en prod.
RECOMENDACION: Agregar requireAuth; setear org_id del auth; validar ownership del appointment; envolver generación+persistencia con manejo de error visible.
```

```
ID: PAY-001
SEVERIDAD: P1
AREA: Reembolsos / Autorización (IDOR)
ARCHIVO: src/app/api/clinic/appointments/route.ts:1600-1620 (+ src/lib/clinic/appointment-refund.ts)
VERDICT: CONFIRMED
DESCRIPCION: Las acciones refundAppointmentMercadoPago y markAppointmentRefundedManually sólo validan user.role !== "patient". No resuelven el profesional autenticado ni verifican que el turno le pertenezca; appointment-refund.ts carga el turno sólo por id (service client, sin .eq doctor_id) y reembolsa con el token MP del dueño (apt.doctor_id). El DELETE del mismo archivo (:1575) sí hace .eq("doctor_id", me.id).
NOTA: El DOBLE reembolso SÍ está mitigado (chequea payment_status === "confirmed" y lo pasa a "refunded"; + X-Idempotency-Key). El problema es la AUTORIZACIÓN, no la idempotencia.
IMPACTO: Un médico B dispara el reembolso de un turno del médico A → movimiento de dinero sobre la cuenta MP de A. IDOR de plata.
RECOMENDACION: Resolver el profesional del auth y exigir apt.doctor_id === professional.id antes de reembolsar.
```

```
ID: PAY-002
SEVERIDAD: P1 (= SEC-005; impacto acotado → algunos lo tratarían como P2)
AREA: Webhooks / Verificación de firma (fail-open)
ARCHIVO: src/app/api/clinic/mercadopago/webhook/route.ts:52-64
VERDICT: PLAUSIBLE
DESCRIPCION: La verificación de firma x-signature es condicional a que exista MERCADOPAGO_WEBHOOK_SECRET. Si la env var falta/está vacía, el webhook procesa sin verificar (fail-open). Ruta compartida por pagos de turnos/recetas y suscripciones.
IMPACTO: Sin firma se pierde la única barrera de autenticidad → replay, disparo prematuro de transiciones, sondeo de ids. ACOTADO: el handler re-consulta el pago contra el token del médico y sólo confirma pagos "approved" reales (no se puede fabricar un pago).
RECOMENDACION: Firma OBLIGATORIA en producción: si NODE_ENV==="production" y falta el secret, rechazar en vez de procesar.
```

```
ID: RACE-001
SEVERIDAD: P1
AREA: Concurrencia / Reserva de turnos (TOCTOU)
ARCHIVO: src/app/api/clinic/appointments/route.ts (+ src/lib/clinic/doctor-assign-appointment.ts)
VERDICT: CONFIRMED
DESCRIPCION: No existe garantía DB de unicidad de slot. Ambos flujos (paciente y médico) detectan solapamiento con SELECT + filtro en JS y luego INSERT, sin transacción ni constraint. pg_constraint confirma que appointments sólo tiene UNIQUE en id y access_token.
ESCENARIO: Paciente A y Paciente B reservan el mismo doctor+día+hora simultáneamente: ambos pasan la validación e insertan.
IMPACTO: Turnos duplicados / doble reserva del mismo slot. La validación de frontend/JS no es garantía.
RECOMENDACION: UNIQUE constraint (o EXCLUDE con rango) sobre (professional_id, fecha, hora) — filtrando estados no-cancelados — e insertar manejando la violación como "slot ocupado".
```

```
ID: IDEM-001
SEVERIDAD: P1
AREA: Pagos / Suscripciones recurrentes (Preapproval)
ARCHIVO: src/app/api/clinic/subscription/checkout/route.ts:44-92
VERDICT: PLAUSIBLE
DESCRIPCION: El POST que inicia la suscripción del médico crea un nuevo Preapproval de MP en CADA llamada, sin verificar si ya hay un mercadopago_preapproval_id activo ni cancelar el anterior. El id nuevo pisa al anterior en professionals; si dos preapprovals se autorizan, el webhook sólo refleja el guardado y el primero sigue cobrando de forma recurrente e invisible.
IMPACTO: Doble cobro recurrente "fantasma" al médico (doble click / reintento / dos pestañas en el checkout de suscripción).
RECOMENDACION: Chequear preapproval activo antes de crear; cancelar el anterior o reusar; idempotency key por médico.
```

---

# P2 — MAJOR (30)

Detalle extendido en el doc de origen indicado. Resumen-índice:

| ID | Área | Archivo / Recurso |
| -- | ---- | ----------------- |
| SEC-005 | Pagos / webhook fail-open (= PAY-002) | mercadopago/webhook/route.ts:52-64 |
| SEC-006 | Auth / `ensure-role` sin autenticación | account/ensure-role/route.ts |
| SEC-007 | Pagos / tokens OAuth MP en texto plano en DB | lib/clinic/db/payments.ts |
| SEC-008 | Auth / enumeración de usuarios + sin rate-limiting | account/login + forgot-password |
| SEC-009 | Auth / política de contraseñas débil (min 6, sin leaked-pwd, MFA) | account/set-password + advisors |
| SEC-010 | DB / 32+21 funciones SECURITY DEFINER ejecutables por auth/anon | advisors (public/nodo_clinica) |
| DM-003 | Aislamiento multi-tenant / superficie de datos | schema public |
| DM-004 | Modelo de datos / consistencia | lib/clinic/db/appointments.ts |
| DM-005 | Reglas de negocio / unicidad de slot (≈ RACE-001) | nodo_clinica.appointments (índices) |
| DM-006 | Rendimiento / índices | schema nodo_clinica |
| DM-007 | Aislamiento multi-tenant / integridad | schema nodo_clinica (columns) |
| DM-008 | Deuda técnica / modelo | lib/clinic/db/clinical-records.ts |
| RLS-01 | RLS / integridad clínica cross-tenant | pg_policies (records/notes/soap/...) |
| RLS-02 | RLS / escalación intra-org | pg_policies (professionals/institutions/...) |
| RLS-03 | RLS / superficie y deuda (tablas espejo en public) | schema public |
| CDA-004 | Atomicidad / persistencia parcial (receta) | clinic/prescriptions/route.ts |
| CDA-005 | Atomicidad / persistencia parcial (estudio) | clinic/study-orders/route.ts |
| CDA-006 | Ruta legacy sin auth / IDs del cliente | api/study-orders/route.ts |
| CDA-007 | Sobrescritura de nota clínica / atribución | clinic/notes/route.ts |
| PAY-003 | Idempotencia / confirmación de pago | lib/clinic/appointment-payment.ts |
| PAY-004 | Validación de transferencia / auto-aprobación por el pagador | payment-receipt/validate/route.ts |
| RACE-002 | Reserva de turnos — ruta legacy sin guarda | api/appointments/route.ts |
| RACE-003 | Lost update en cancelación | clinic/appointments/route.ts |
| IDEM-002 | Suscripción recurrente paciente (Preapproval) | patient-subscription/checkout/route.ts |
| IDEM-003 | Turnos / creación concurrente (≈ RACE-001) | clinic/appointments/route.ts |
| IDEM-004 | Recetas y estudios / creación duplicada (≈ CDA-001) | clinic/prescriptions + study-orders |
| SUPA-002 | RLS / performance de query (patient_health_profiles) | Supabase policy |
| SUPA-003 | Índices / performance (patient_documents) | Supabase |
| SUPA-004 | Query — lista sin paginar | clinic/appointments/route.ts |
| SUPA-005 | Realtime — canal sin acotar (broadcast amplio) | dashboard/doctor-dashboard.tsx |

# P3 — MINOR (22)

| ID | Área | Archivo / Recurso |
| -- | ---- | ----------------- |
| SEC-011 | function_search_path_mutable en funciones de acceso | advisors |
| SEC-012 | RLS habilitada sin policy (defensa en profundidad) | advisors |
| SEC-013 | pg_net en schema public | advisors |
| DM-009 | Auditoría / trazabilidad | schema nodo_clinica / src |
| DM-010 | Multi-tenant / patients | nodo_clinica.patients |
| RLS-04 | SECURITY DEFINER search_path | auth_user_role/is_assigned_doctor/... |
| RLS-05 | Frontera desplazada a la API (deny-all) | payment_credentials/medical_records/... |
| RLS-06 | Confidencialidad intra-organización | pg_policies (records/prescriptions/...) |
| RLS-07 | SECURITY DEFINER view | nodo_clinica.medical_specialties |
| CDA-008 | Idempotencia / duplicados (≈ RACE-001) | prescriptions + study-orders |
| CDA-009 | Endpoint de IA sin auth / PHI / costo | clinic/clinical-report/generate/route.ts |
| PAY-005 | Doble cobro / reconciliación | mercadopago/checkout.ts |
| PAY-006 | OAuth / exposición de configuración | mercadopago/oauth/diagnose/route.ts |
| RACE-004 | Confirmación de pago (webhook) concurrente | lib/clinic/appointment-payment.ts |
| RACE-005 | Update de estado sin bloqueo optimista | clinic/appointments/route.ts |
| IDEM-005 | Webhook de pago / efectos colaterales | lib/clinic/appointment-payment.ts |
| SUPA-001 | Higiene de esquema / advisors | Supabase (public) |
| SUPA-006 | Polling agregado — costo de sesión activa | layout/medico-admin-layout.tsx |
| SUPA-007 | Over-fetching de columnas | lib/clinic/db/*.ts, api/clinic/** |
| SUPA-008 | Políticas permisivas duplicadas | Supabase (varias tablas) |
| SUPA-009 | Cron — escritura fila por fila | cron/appointment-reminders/route.ts |
| SUPA-010 | Índices no utilizados (posible FP por bajo volumen) | Supabase |

---

## Orden de corrección recomendado (antes del médico real)

1. **SEC-001 + SEC-002** — `REVOKE ... FROM PUBLIC, anon` en las 4 RPC (public + nodo_core) + auth interna. (P0/P1, fix de minutos, altísimo impacto.)
2. **DM-001** — quitar `ON DELETE CASCADE` de datos clínicos (pérdida irreversible + legal).
3. **CDA-001 / CDA-002 / PAY-001** — enforcement de ownership (doctor_id del auth, no del body) en escritura y borrado clínico y en refunds.
4. **SEC-003** — fail-fast del secreto de sesión en prod; dejar de matchear paciente por email.
5. **RACE-001** — UNIQUE/EXCLUDE de slot en `appointments`.
6. **CDA-003** — auth + org_id en `/api/soap/generate` (además está rota).
7. **PAY-002** — firma de webhook obligatoria en prod.
8. **SEC-004** — rotar el PAT de Supabase.
9. **IDEM-001** — dedupe de Preapproval de suscripción.
10. **DM-002** — versionar el schema vivo a migraciones (DR).
