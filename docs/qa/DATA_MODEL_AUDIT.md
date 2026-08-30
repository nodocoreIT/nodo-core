# Auditoría de Modelo de Datos e Integridad — Nodo Clínica

- **Proyecto Supabase:** NodoCore (`project_id: iprrlgmhpsxzyrejabtu`)
- **Rol del auditor:** Senior Supabase Architect + Data Integrity
- **Alcance:** Introspección en vivo (solo lectura) de `pg_constraint`, `pg_indexes`, `information_schema`, `pg_class`, `pg_policies`, cruzada contra las 50 migraciones en `nodo-clinica/supabase/migrations/`.
- **Fecha:** 2026-08-29
- **Método:** Solo lectura. Ninguna mutación de datos, DDL ni configuración.

---

## Hallazgo estructural crítico (contexto para todo lo que sigue)

El brief del orquestador asumía que las tablas de clínica viven en el schema `public`. **Eso es incorrecto.** La aplicación opera sobre el schema **`nodo_clinica`**:

```
src/lib/supabase/server.ts:41        db: { schema: "nodo_clinica" },
src/lib/supabase/auth-guard.ts:43    db: { schema: "nodo_clinica" },
src/lib/supabase/clinica-auth.ts:2   db: { schema: "nodo_clinica" },
```

En `public` existen **copias duplicadas y obsoletas** de casi todas las tablas clínicas (`appointments`, `patients`, `clinical_records`, `clinical_notes`, `transcriptions`, `prescriptions`, `study_orders`, `soap_summaries`, `patient_documents`, `audit_logs`, `medical_specialties`). La `public.appointments` NO tiene ninguna de las columnas agregadas por migraciones posteriores (no tiene `appointment_type`, `institution_id`, `payment_status`, `refund_*`, y `jitsi_room_id` sigue siendo `NOT NULL`), mientras que `nodo_clinica.appointments` sí las tiene. Esto prueba que `public` es un remanente muerto y `nodo_clinica` es la fuente de verdad. Todos los hallazgos de este documento se refieren al schema autoritativo `nodo_clinica`, salvo DM-003 que trata específicamente de las tablas huérfanas en `public`.

Resumen de severidades: **2× P1**, **5× P2**, **3× P3**. Ninguna tabla clínica tiene filas todavía (pre-producción), por lo que la probabilidad de varios hallazgos se pondera hacia "aún no explotado" pero el riesgo estructural persiste.

---

## DM-001 — Cadena de borrado `ON DELETE CASCADE` destruye historia clínica y recetas

```
ID: DM-001
SEVERIDAD: P1
AREA: Integridad de datos / Retención legal
ARCHIVO: supabase/migrations/* (definición en DB nodo_clinica)
LINEA: FKs de clinical_records, prescriptions, appointments
DESCRIPCION: El borrado de un professional (o patient, u organization) dispara una
  cascada que elimina permanentemente historia clínica, recetas, órdenes de estudio,
  transcripciones y resúmenes SOAP. En un sistema médico esto es documentación de
  retención obligatoria (Argentina, Ley 26.529 de Derechos del Paciente: la historia
  clínica debe conservarse mínimo 10 años).
EVIDENCIA:
  appointments_doctor_id_fkey:      FOREIGN KEY (doctor_id) REFERENCES professionals(id) ON DELETE CASCADE
  appointments_professional_id_fkey: FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE
  appointments_patient_id_fkey:     FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  clinical_records_doctor_id_fkey:  FOREIGN KEY (doctor_id) REFERENCES professionals(id) ON DELETE CASCADE
  clinical_records_patient_id_fkey: FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  prescriptions_doctor_id_fkey:     FOREIGN KEY (doctor_id) REFERENCES professionals(id) ON DELETE CASCADE
  prescriptions_appointment_id_fkey:FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
  study_orders_doctor_id_fkey:      FOREIGN KEY (doctor_id) REFERENCES professionals(id) ON DELETE CASCADE
  transcriptions_appointment_id_fkey:FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
  soap_summaries_appointment_id_fkey:FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
  patient_documents_appointment_id_fkey:FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
  # Nota comparativa: la tabla medical_records SÍ usa ON DELETE RESTRICT sobre professional_id
  # (medical_records_professional_id_fkey ... ON DELETE RESTRICT) — el diseño seguro existe pero
  # está en una tabla muerta (ver DM-008).
ESCENARIO PARA REPRODUCIR:
  1) Un admin borra la fila de un professional (baja definitiva, limpieza, error operativo).
  2) CASCADE elimina todos sus appointments; cada appointment borrado elimina en cascada
     sus transcriptions, soap_summaries, clinical_notes, patient_documents y prescriptions
     ligadas por appointment_id.
  3) clinical_records.doctor_id CASCADE elimina además todo el historial clínico redactado.
  4) La historia clínica y las recetas del paciente desaparecen sin recuperación.
IMPACTO: Pérdida irreversible de documentación clínica y de recetas con validez legal.
  Incumplimiento de retención obligatoria. Un solo DELETE mal aplicado borra el historial
  de todos los pacientes de un médico.
PROBABILIDAD: media (la app usa soft-delete vía professionals.paused_at / patients.paused_at,
  pero no hay barrera de DB contra un hard-delete manual o un borrado de organization en cascada).
RECOMENDACION: Reemplazar CASCADE por ON DELETE RESTRICT (o SET NULL con columna de auditoría)
  en todas las FK que apunten a datos clínicos/recetas desde professionals/patients/appointments.
  Adoptar soft-delete a nivel esquema y prohibir hard-delete de professionals/patients/organizations
  mientras existan registros clínicos. Alinear con el criterio ya usado en medical_records
  (ON DELETE RESTRICT). NO implementar aquí.
```

---

## DM-002 — Deriva de esquema: tablas creadas fuera de las migraciones rastreadas

```
ID: DM-002
SEVERIDAD: P1
AREA: Gobernanza de esquema / Reproducibilidad / DR
ARCHIVO: supabase/migrations/20260829_prescriptions_standalone.sql
LINEA: 6-13 (comentario de cabecera)
DESCRIPCION: Varias tablas centrales del schema nodo_clinica no tienen migración CREATE TABLE
  en el repositorio; fueron aplicadas a mano directamente contra Supabase. La carpeta de
  migraciones NO puede reconstruir la base desde cero, y no hay paridad entre migraciones y DB.
EVIDENCIA:
  Comentario textual en la migración de recetas:
  "The `prescriptions` table itself is NOT among this repo's tracked migrations — its base
   schema was applied directly to Supabase in an earlier, untracked step. Exactly like
   20260827b_patient_documents_personal_library.sql before it, this session has no live DB
   access to confirm current nullability..."
  Tablas presentes en nodo_clinica sin CREATE TABLE rastreable en migrations/:
   prescriptions (base), patient_documents (base), clinical_records, medical_records,
   patient_health_profiles, doctor_notifications, doctor_presence, doctor_tasks,
   chat_read_cursors, interconsult_messages, health_insurances.
  Prueba adicional de deriva: existen dos copias divergentes del esquema (public obsoleto vs
   nodo_clinica actual) — ver hallazgo estructural arriba.
ESCENARIO PARA REPRODUCIR:
  1) Clonar el repo y correr las migraciones contra una base limpia.
  2) Las tablas listadas no se crean (o se crean incompletas) → la app no arranca / falla en runtime.
IMPACTO: Imposible reconstruir la base para entornos nuevos, staging o recuperación ante desastres.
  Riesgo de que producción tenga columnas/constraints que nadie puede versionar ni revisar.
  Auditoría y rollback comprometidos.
PROBABILIDAD: alta (ya ocurrió y está documentado en el propio repo).
RECOMENDACION: Generar migraciones de "catch-up" (supabase db pull / dump del schema nodo_clinica)
  que capturen el estado real y lo versionen. Prohibir cambios manuales fuera de migración.
  Verificar paridad DB↔migraciones en CI. NO implementar aquí.
```

---

## DM-003 — Tablas clínicas duplicadas y obsoletas en el schema `public` con RLS/políticas activas

```
ID: DM-003
SEVERIDAD: P2
AREA: Superficie de datos / Aislamiento multi-tenant
ARCHIVO: schema public (DB)
LINEA: n/a
DESCRIPCION: El schema public contiene copias muertas de las tablas clínicas, con RLS habilitada
  y políticas definidas, no usadas por la aplicación (que opera en nodo_clinica). Son un
  duplicado divergente (esquema viejo) que confunde el modelo y es un footgun a futuro: cualquier
  cambio accidental de `db.schema` o un cliente que caiga al schema por defecto escribiría/leería
  la tabla equivocada.
EVIDENCIA (pg_class + pg_policies, public):
  appointments      rls=true  policies=2
  patients          rls=true  policies=2
  clinical_records  rls=true  policies=2
  clinical_notes    rls=true  policies=1
  transcriptions    rls=true  policies=1
  prescriptions     rls=true  policies=2
  study_orders      rls=true  policies=2
  soap_summaries    rls=true  policies=1
  patient_documents rls=true  policies=4
  audit_logs        rls=true  policies=2
  medical_specialties rls=true policies=1
  # public.appointments carece de columnas que sí tiene nodo_clinica.appointments
  # (appointment_type, institution_id, payment_status, refund_*, jitsi_room_id NOT NULL) → prueba de que es obsoleta.
ESCENARIO PARA REPRODUCIR:
  1) Un endpoint nuevo omite `.schema("nodo_clinica")` y usa el cliente por defecto sobre public.
  2) Escribe/lee la tabla obsoleta; los datos quedan invisibles para el resto de la app o
     se generan inconsistencias silenciosas.
IMPACTO: Confusión de modelo, drift, riesgo de escritura/lectura al schema equivocado, y
  superficie de políticas RLS que hay que auditar por duplicado.
PROBABILIDAD: baja-media.
RECOMENDACION: Eliminar (DROP) las tablas obsoletas de public tras confirmar 0 filas y 0 uso,
  o renombrarlas a un schema `_deprecated`. Documentar que nodo_clinica es el único schema
  clínico. NO implementar aquí.
```

---

## DM-004 — `appointments` con columnas de propiedad redundantes que pueden divergir

```
ID: DM-004
SEVERIDAD: P2
AREA: Modelo de datos / Consistencia
ARCHIVO: src/lib/clinic/db/appointments.ts
LINEA: 21-22, 54-55 (AppointmentInsert)
DESCRIPCION: appointments tiene DOS columnas que apuntan al mismo médico —doctor_id y
  professional_id— ambas NOT NULL y ambas FK a professionals(id) ON DELETE CASCADE. También
  duplica la fecha en scheduled_at y appointment_date (ambas NOT NULL). No hay constraint que
  garantice doctor_id = professional_id ni scheduled_at = appointment_date; pueden divergir.
EVIDENCIA:
  information_schema.columns (nodo_clinica.appointments):
    doctor_id        uuid NOT NULL
    professional_id  uuid NOT NULL
    scheduled_at     timestamptz NOT NULL
    appointment_date timestamptz NOT NULL
  El código exige poblar ambas en cada alta:
    export interface AppointmentInsert {
      ...
      doctor_id: string;
      professional_id: string;
      ...
      scheduled_at: string;
      appointment_date: string;
    }
  Las queries filtran solo por doctor_id (appointments.ts:101,180); professional_id parece
  vestigial pero es obligatorio.
ESCENARIO PARA REPRODUCIR:
  1) Un insert (o backfill) setea doctor_id ≠ professional_id, o scheduled_at ≠ appointment_date.
  2) Distintas partes del sistema (o reportes) leen columnas distintas y muestran datos inconsistentes.
IMPACTO: Estado inválido posible; ambigüedad sobre cuál columna es la verdad; mayor superficie
  de bug y de mantenimiento.
PROBABILIDAD: media.
RECOMENDACION: Consolidar en una sola columna de médico y una sola de fecha; si deben coexistir
  por transición, agregar CHECK (doctor_id = professional_id) y CHECK (scheduled_at = appointment_date)
  o una columna generada. NO implementar aquí.
```

---

## DM-005 — Sin constraint UNIQUE anti doble-turno en `appointments`

```
ID: DM-005
SEVERIDAD: P2
AREA: Modelo de datos / Reglas de negocio
ARCHIVO: schema nodo_clinica.appointments (índices)
LINEA: n/a
DESCRIPCION: No existe constraint/índice único que impida agendar dos turnos en el mismo slot
  para el mismo médico. La unicidad de horario depende exclusivamente de chequeos en la app,
  que ante condiciones de carrera (dos pacientes reservando a la vez) pueden fallar.
EVIDENCIA (pg_indexes de nodo_clinica.appointments — no hay unique sobre (doctor_id, scheduled_at)):
  appointments_pkey            UNIQUE (id)
  appointments_access_token_key UNIQUE (access_token)
  idx_clinica_appointments_doctor      (org_id, doctor_id, status)   -- no único
  idx_clinica_appointments_patient     (org_id, patient_id)          -- no único
  idx_clinica_appointments_patient_id  (patient_id)
  idx_appointments_type                (appointment_type)
ESCENARIO PARA REPRODUCIR:
  1) Dos pacientes abren el mismo horario disponible simultáneamente.
  2) Ambas requests pasan el chequeo de disponibilidad en la app antes de insertar.
  3) Se crean dos appointments en el mismo slot; el médico queda con doble reserva.
IMPACTO: Doble reserva del mismo horario; sobreventa de turnos; conflicto en sala de espera.
PROBABILIDAD: media (depende de concurrencia; sin barrera de DB el riesgo es real).
RECOMENDACION: Agregar un índice único parcial que refleje la regla real de negocio, p.ej.
  UNIQUE (doctor_id, scheduled_at) WHERE status <> 'cancelled'. Evaluar si aplica a virtual y
  presencial. NO implementar aquí.
```

---

## DM-006 — Índices faltantes en claves foráneas y columnas de consulta caliente

```
ID: DM-006
SEVERIDAD: P2
AREA: Rendimiento
ARCHIVO: schema nodo_clinica (índices)
LINEA: n/a
DESCRIPCION: Múltiples FKs y columnas usadas en filtros/listados no tienen índice. Además de
  degradar los listados por paciente/médico, cada CASCADE/SET NULL sobre professionals o
  appointments hace seq scan de las tablas hijas.
EVIDENCIA (FKs sin índice de respaldo, según pg_indexes vs pg_constraint):
  prescriptions:   doctor_id, patient_id, appointment_id, org_id, institution_id  → SIN índice
                   (solo hay idx sobre access_token y patient_email)
  study_orders:    org_id, appointment_id, doctor_id, patient_id                  → SIN índice (solo PK)
  patient_documents: patient_id, appointment_id, org_id, study_order_id           → SIN índice (solo PK)
  medical_records: patient_id, professional_id, appointment_id                    → SIN índice (solo PK)
  clinical_records: doctor_id, appointment_id                                     → SIN índice
  appointments:    professional_id, institution_id                               → SIN índice
                   (doctor_id solo cubierto por composite con org_id como col líder)
  interconsult_messages: from_professional_id, to_professional_id, org_id         → SIN índice
  payment_credentials: org_id                                                     → SIN índice
  office_settings: org_id                                                         → SIN índice
  soap_summaries / transcriptions: org_id                                         → SIN índice
ESCENARIO PARA REPRODUCIR:
  1) Listar recetas de un paciente (WHERE patient_id = ...) → seq scan de prescriptions.
  2) Borrar/despausar un professional → seq scan de study_orders, patient_documents, etc.
IMPACTO: Latencia creciente con el volumen; costo de CPU/IO; timeouts en listados a escala.
PROBABILIDAD: alta (a medida que crezca el volumen; hoy 0 filas).
RECOMENDACION: Crear índices btree sobre las columnas FK y las columnas de filtro frecuentes
  (patient_id, doctor_id/professional_id, appointment_id, org_id). NO implementar aquí.
```

---

## DM-007 — Enlaces de propiedad (`org_id`) nulos permiten filas huérfanas / fuga entre tenants

```
ID: DM-007
SEVERIDAD: P2
AREA: Aislamiento multi-tenant / Integridad
ARCHIVO: schema nodo_clinica (columns)
LINEA: n/a
DESCRIPCION: Columnas de tenencia que deberían ser NOT NULL admiten NULL. Una fila con org_id
  NULL queda fuera del alcance de políticas RLS basadas en org_id (puede volverse inaccesible o,
  según la política, visible fuera de su tenant), y no tiene dueño.
EVIDENCIA (information_schema.columns):
  patient_documents.org_id           is_nullable = YES
  interconsult_messages.org_id       is_nullable = YES
  interconsult_messages.to_professional_id is_nullable = YES
  # Comparar con el resto del esquema donde org_id es NOT NULL (appointments, clinical_records,
  # prescriptions, study_orders, soap_summaries, transcriptions, patients, professionals).
ESCENARIO PARA REPRODUCIR:
  1) Se inserta un patient_document sin org_id (o queda NULL por un path que no lo setea).
  2) Las políticas RLS que filtran por org_id no matchean la fila → documento clínico huérfano
     o con visibilidad inconsistente entre organizaciones.
IMPACTO: Documentos/mensajes clínicos sin dueño; riesgo de aislamiento multi-tenant; datos
  invisibles o potencialmente expuestos según la política RLS.
PROBABILIDAD: media.
RECOMENDACION: Backfill de org_id y luego SET NOT NULL en patient_documents.org_id e
  interconsult_messages.org_id; definir política clara para mensajes sin destinatario. NO implementar aquí.
```

---

## DM-008 — Tabla muerta `medical_records` (diseño seguro) frente a `clinical_records` (diseño en cascada) en uso

```
ID: DM-008
SEVERIDAD: P2
AREA: Modelo de datos / Deuda técnica
ARCHIVO: src/lib/clinic/db/clinical-records.ts
LINEA: n/a
DESCRIPCION: Coexisten dos tablas para historia clínica: clinical_records (usada por la app,
  con doctor_id ON DELETE CASCADE) y medical_records (0 referencias en el código, con
  professional_id ON DELETE RESTRICT). El diseño con retención segura (RESTRICT) está muerto,
  mientras el que borra en cascada (ver DM-001) es el activo.
EVIDENCIA:
  rg 'medical_records' src  → 0 resultados (tabla sin uso en la aplicación)
  rg 'clinical_records' src → múltiples (clinical-records.ts, prescriptions/route.ts, patient-history/route.ts, ...)
  Constraints:
    medical_records_professional_id_fkey  FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE RESTRICT
    clinical_records_doctor_id_fkey       FOREIGN KEY (doctor_id)       REFERENCES professionals(id) ON DELETE CASCADE
ESCENARIO PARA REPRODUCIR:
  1) Buscar en el código cualquier lectura/escritura de medical_records → no existe.
  2) Confirmar que la historia clínica se maneja en clinical_records (con CASCADE).
IMPACTO: Confusión de modelo; la protección de retención (RESTRICT) no aplica a la tabla real;
  deuda técnica y superficie de esquema innecesaria.
PROBABILIDAD: baja (impacto de mantenimiento; refuerza el riesgo de DM-001).
RECOMENDACION: Decidir una única tabla de historia clínica. Si medical_records es legado, DROP
  tras verificar 0 filas; si es el destino deseado, migrar y adoptar su RESTRICT. NO implementar aquí.
```

---

## DM-009 — Sin tabla de auditoría en `nodo_clinica` (solo una copia obsoleta y sin uso en `public`)

```
ID: DM-009
SEVERIDAD: P3
AREA: Auditoría / Trazabilidad
ARCHIVO: schema nodo_clinica / src
LINEA: n/a
DESCRIPCION: No existe tabla audit_logs en el schema nodo_clinica; la única copia está en public
  (obsoleta, ver DM-003) y no tiene referencias en el código. No hay trail de auditoría de acceso
  o modificación sobre datos clínicos sensibles.
EVIDENCIA:
  Listado de tablas de nodo_clinica NO incluye audit_logs.
  information_schema.tables: audit_logs solo aparece en schemas public y nodo_autos.
  rg 'audit_logs' src → 0 resultados en la app de clínica.
ESCENARIO PARA REPRODUCIR:
  1) Un médico consulta o edita la historia de un paciente.
  2) No queda registro de quién accedió/modificó qué y cuándo.
IMPACTO: Falta de trazabilidad sobre datos de salud; dificulta cumplimiento y análisis forense.
PROBABILIDAD: baja (no es un bug de runtime, es una brecha de control).
RECOMENDACION: Definir e instrumentar auditoría (tabla + triggers o logging aplicativo) para
  accesos y cambios sobre tablas clínicas. NO implementar aquí.
```

---

## DM-010 — `UNIQUE(dni)` global inconsistente con el resto del modelo multi-tenant

```
ID: DM-010
SEVERIDAD: P3
AREA: Modelo de datos / Multi-tenant
ARCHIVO: schema nodo_clinica.patients
LINEA: n/a
DESCRIPCION: patients tiene UNIQUE(dni) global (cross-org) mientras que la unicidad de email es
  por organización (UNIQUE(org_id, email)). El DNI es un dato de persona que puede repetirse
  entre organizaciones (un mismo paciente atendido por médicos de distintas orgs), y la unicidad
  global impide registrarlo dos veces.
EVIDENCIA (pg_constraint / pg_indexes):
  patients_dni_key        UNIQUE (dni)               -- global, cross-org
  patients_org_id_email_key UNIQUE (org_id, email)   -- por tenant
  patients_profile_id_key UNIQUE (profile_id) WHERE profile_id IS NOT NULL
ESCENARIO PARA REPRODUCIR:
  1) Un paciente con DNI X ya existe en la organización A.
  2) La organización B intenta registrar al mismo paciente (mismo DNI) → falla por unicidad global.
IMPACTO: Bloqueo de alta legítima en un modelo multi-tenant; o, si es intencional (una persona =
  una fila global), incoherencia con el modelo per-org del resto de patients.
PROBABILIDAD: baja (dni es nullable; solo afecta cuando se completa y hay solapamiento entre orgs).
RECOMENDACION: Decidir el modelo: si patients es por-tenant, cambiar a UNIQUE(org_id, dni); si es
  identidad global de persona, documentarlo y unificar el resto del modelo. NO implementar aquí.
```

---

## Notas de verificación / anti-falso-positivo

- Todos los DDL citados provienen de `pg_constraint.pg_get_constraintdef`, `pg_indexes.indexdef` e `information_schema.columns` consultados en vivo sobre `iprrlgmhpsxzyrejabtu`, schema `nodo_clinica`.
- Se confirmó que la app usa `nodo_clinica` (no `public`) leyendo `server.ts`, `auth-guard.ts`, `clinica-auth.ts`.
- Se confirmó por grep que `medical_records` y `audit_logs` no tienen uso en `src/`.
- Aspectos correctos observados (no reportados): PK y unicidad presentes en `patient_health_profiles(patient_id)`, `payment_credentials(professional_id)`, `pending_clinic_registrations` (índice parcial por email/role no verificado), `obras_sociales(name)`, `medical_directory(city,category,place_id)`, `pharmacy_on_call_schedules(city,year,month)`; CHECK constraints presentes para `appointments.status`, `payment_status`, `appointment_type`, `refund_method`, `cancelled_by`, `professionals.subscription_status`, `patients.billing_cycle`. Triggers `moddatetime` correctamente aplicados donde hay `updated_at`.
```
```
