# Auditoría de Infraestructura Supabase / PostgreSQL — Nodo Clínica

**Proyecto Supabase:** NodoCore (`iprrlgmhpsxzyrejabtu`)
**Alcance:** performance advisors + patrones de acceso a datos en `src/` de `nodo-clinica`
**Fecha:** 2026-08-29
**Rol:** Infra Supabase + Performance Engineer (PostgreSQL)

> Nota de contexto: al momento de esta auditoría, las tablas activas de Clínica (`nodo_clinica.*`) tienen muy pocas filas (0 a 27 según la tabla). Varios hallazgos de "performance" no tienen impacto medible **hoy**, pero sí lo tendrán cuando el volumen de datos crezca en producción real — se los marca como tal.

---

## 0. Hallazgo de arquitectura: existe un esquema `public` duplicado, sin uso, con las mismas tablas clínicas

Antes de listar los hallazgos de advisors, hay un dato que cambia cómo hay que leerlos: **el Supabase de NodoCore tiene DOS copias del modelo de datos clínico** — un esquema `public` (`public.patients`, `public.appointments`, `public.clinical_records`, `public.clinical_notes`, `public.transcriptions`, `public.prescriptions`, `public.study_orders`, `public.soap_summaries`, `public.patient_documents`, `public.audit_logs`) y un esquema `nodo_clinica` con las mismas tablas (más varias adicionales: `professionals`, `institutions`, `doctor_notifications`, `interconsult_messages`, etc).

Verificado con `list_tables`: las tablas en `public.*` tienen **0 filas** todas, mientras que sus equivalentes en `nodo_clinica.*` tienen datos reales (`nodo_clinica.patients` = 8, `nodo_clinica.appointments` = 13, `nodo_clinica.professionals` = 11, etc). Verificado en código (`rg "db:.*schema"` sobre `src/lib/supabase/*.ts`) que **toda** la app apunta a `nodo_clinica`:

```
src/lib/supabase/server.ts:41:  db: { schema: "nodo_clinica" },   // createServiceClient()
src/lib/supabase/server.ts:55:  db: { schema: "shared" },         // createSharedServiceClient()
src/lib/supabase/server.ts:70:  db: { schema: "nodo_core" },      // createNodoCoreServiceClient()
src/lib/supabase/clinica-auth.ts:2:  db: { schema: "nodo_clinica" },
src/lib/supabase/auth-guard.ts:43:  db: { schema: "nodo_clinica" },
```

No se encontró ningún factory de cliente que cree un `createClient` de `@supabase/supabase-js` sin `db.schema` explícito para datos clínicos, así que **no hay hoy un camino de código real que escriba por accidente en `public.*`** — el riesgo de "escritura fantasma" queda descartado (anti-falso-positivo). El problema es más acotado:

```
ID: SUPA-001
SEVERIDAD: P3
AREA: Higiene de esquema / advisors
ARCHIVO: (Supabase — esquema `public`, sin migración correspondiente en supabase/migrations que lo documente como activo)
LINEA: N/A
DESCRIPCION: El esquema `public` contiene una copia completa y desactualizada del modelo clínico (patients, appointments, clinical_records, clinical_notes, transcriptions, prescriptions, study_orders, soap_summaries, patient_documents, audit_logs), con RLS y policies configuradas, pero sin ninguna fila y sin ningún consumidor en el código de la app.
EVIDENCIA: list_tables → "public.patients":rows=0 ... "nodo_clinica.patients":rows=8. get_advisors performance reporta 108 lints sobre schema "public" (unindexed_foreign_keys, auth_rls_initplan, multiple_permissive_policies) contra tablas sin uso.
ESCENARIO PARA REPRODUCIR: Ejecutar `list_tables` con schemas ["public","nodo_clinica"] y comparar `rows`; ejecutar `get_advisors(type=performance)` y filtrar por `metadata.schema == "public"`.
IMPACTO: Ruido: ~108 de 381 lints de advisors (28%) corresponden a tablas muertas, dificultando priorizar los hallazgos reales sobre `nodo_clinica`. Riesgo latente: si en el futuro alguien agrega un cliente Supabase nuevo sin pasar `db.schema`, el default de supabase-js es `public` — escribiría silenciosamente en la tabla fantasma en vez de fallar, y el bug pasaría desapercibido porque las tablas existen y aceptan la escritura.
PROBABILIDAD: baja (hoy no hay código que dispare esto; el riesgo es sobre código futuro)
RECOMENDACION: Antes de producción, eliminar (DROP) las tablas clínicas duplicadas en `public` si son legado de una migración anterior al esquema `nodo_clinica`, o documentar explícitamente por qué coexisten. Revisar el resto de docs/qa (esta auditoría no cubre seguridad/RLS a fondo — ver el documento de seguridad del equipo para RLS).
```

El resto de este documento se enfoca en **`nodo_clinica`** (el esquema real) y en los patrones de código sobre `src/`.

---

## 1. Resumen de `get_advisors(type=performance)`

Total de lints devueltos por el proyecto completo: **381**, repartidos así por schema:

| Schema | Lints |
|---|---|
| `public` | 108 (mayormente tablas muertas de Clínica, ver §0, más otros productos del monorepo) |
| `nodo_finanzas_personales` | 90 |
| `nodo_clinica` | **68** |
| `nodo_inmo` | 36 |
| `nodo_tienda` | 26 |
| `nodo_core` | 27 |
| `nodo_autos` | 15 |
| `shared` | 10 |

Desglose de los **68 lints de `nodo_clinica`** (el esquema activo de la app) por categoría:

| Categoría | Cantidad | Severidad advisor |
|---|---|---|
| `unindexed_foreign_keys` | 37 | INFO |
| `multiple_permissive_policies` | 24 | WARN |
| `unused_index` | 6 | INFO |
| `auth_rls_initplan` | 1 | WARN |

No hay lints de `auth_db_connections_absolute` en `nodo_clinica` (ese único hallazgo del proyecto es de otro schema). No aplica a este esquema.

---

## 2. Hallazgos verificados

```
ID: SUPA-002
SEVERIDAD: P2
AREA: RLS / performance de queries
ARCHIVO: (Supabase — policy `health_profile_patient_self` sobre `nodo_clinica.patient_health_profiles`)
LINEA: N/A
DESCRIPCION: La policy re-evalúa `auth.uid()` fila por fila en vez de cachear el valor con `(select auth.uid())`. Confirmado con SQL directo sobre `pg_policies` — es la única política de `nodo_clinica` marcada por el advisor `auth_rls_initplan`, pero está sobre una tabla de datos de salud sensibles (perfil de salud del paciente) que se consulta en cada acceso del paciente a su historia clínica.
EVIDENCIA: `select qual from pg_policies where policyname='health_profile_patient_self'` → `(patient_id IN ( SELECT patients.id FROM nodo_clinica.patients WHERE (patients.profile_id = auth.uid())))` — nótese que NO usa `(select auth.uid())`, a diferencia de otras policies de la misma tabla (ej. `patient_select_patient_documents` sí usa `(patients.profile_id = ( SELECT auth.uid() AS uid))`).
ESCENARIO PARA REPRODUCIR: `execute_sql` → `select policyname, qual from pg_policies where schemaname='nodo_clinica' and tablename='patient_health_profiles';`
IMPACTO: Con 0-pocas filas hoy no se nota. A escala (miles de perfiles), Postgres invoca `auth.uid()` una vez por cada fila evaluada en el plan en lugar de una vez por statement, degradando el tiempo de respuesta de cualquier query sobre `patient_health_profiles` proporcionalmente al tamaño de la tabla.
PROBABILIDAD: alta (se dispara en cuanto la tabla tenga volumen real, es determinístico)
RECOMENDACION: Reescribir la policy usando `(select auth.uid())` en vez de `auth.uid()`, igual que ya se hizo en las otras policies de `patient_documents` y `patients`. Cambio de una sola línea de SQL, sin impacto funcional.
```

```
ID: SUPA-003
SEVERIDAD: P2
AREA: Índices / performance de queries
ARCHIVO: (Supabase — tabla `nodo_clinica.patient_documents`)
LINEA: N/A
DESCRIPCION: `patient_documents` no tiene ningún índice secundario — solo la primary key (`patient_documents_pkey` sobre `id`). No hay índice sobre `appointment_id`, `patient_id`, `org_id` ni `study_order_id`, pese a que las 4 columnas son foreign keys y las 4 se usan activamente en queries y policies de RLS del código de la app.
EVIDENCIA: `select indexname from pg_indexes where schemaname='nodo_clinica' and tablename='patient_documents'` → solo devuelve `patient_documents_pkey`. Uso real en código: `src/app/api/clinic/appointments/route.ts:156` (`.eq("appointment_id", apt.id)`), `src/lib/clinic/db/clinical-records.ts:300` (`.from("patient_documents").select("*")` filtrable por patient), policy RLS `staff_select_patient_documents`: `(org_id = nodo_clinica.current_org_id())`.
ESCENARIO PARA REPRODUCIR: `execute_sql` → `select indexname, indexdef from pg_indexes where schemaname='nodo_clinica' and tablename='patient_documents';` y comparar contra los `.eq()` usados en `src/app/api/clinic/documents/route.ts` y `src/app/api/clinic/appointments/route.ts`.
IMPACTO: Toda lectura de documentos por turno, por paciente o por organización (incluyendo la policy RLS `staff_select_patient_documents` que se evalúa en CADA select de esta tabla por cualquier staff) hace un seq scan completo de la tabla. Es además la tabla con más JOINs no filtrados en runtime (`appointments.select("*, patient_documents(*)")` en varios endpoints — ver SUPA-005).
PROBABILIDAD: alta a mediano plazo (crece con cada estudio/receta subido por paciente)
RECOMENDACION: Agregar índices sobre `appointment_id`, `patient_id` y `org_id` (y evaluar `study_order_id` si se filtra seguido). El advisor de Supabase ya señala estas 4 FKs sin cobertura — priorizar esta tabla sobre el resto de las 37 FKs sin índice del esquema porque es la más consultada en runtime.
```

```
ID: SUPA-004
SEVERIDAD: P2
AREA: Query anti-pattern — lista sin paginar
ARCHIVO: src/app/api/clinic/appointments/route.ts
LINEA: 538-544 (`scope === "pending_payment"`)
DESCRIPCION: El endpoint que arma la lista de "turnos con pago pendiente de revisión" del médico trae TODOS los turnos no cancelados del doctor, sin `.limit()` ni `.range()`, con dos joins anidados (`patients(full_name)` y `patient_documents(*)`), y filtra/mapea en JS después. Compárese con las otras dos ramas del mismo archivo (`scope=cobros_received` línea 385 y `scope=payment_ledger` línea 435), que sí usan `.limit(100)` / `.limit(500)` sobre la misma tabla.
EVIDENCIA: `const { data: all } = await svc.from("appointments").select("*, patients(full_name), patient_documents(*)").eq("doctor_id", doctorId).neq("status", "cancelled").order("scheduled_at", { ascending: true });` — sin limit/range.
ESCENARIO PARA REPRODUCIR: Abrir `/api/clinic/appointments?doctorId=<id>&scope=pending_payment` para un médico con historial extenso de turnos no cancelados.
IMPACTO: A medida que un médico acumula historial (meses/años de turnos), este endpoint transfiere y procesa en cada carga TODAS las filas de `appointments` de ese doctor con dos joins completos, incluyendo `patient_documents(*)` que puede incluir múltiples documentos por turno. Egress y CPU crecen linealmente sin techo — es la única de las 3 ramas de "listas de pagos" del archivo sin cap.
PROBABILIDAD: media (hoy con pocos turnos no impacta; se activa con el uso normal del producto en el tiempo)
RECOMENDACION: Acotar con `.limit(N)` + fecha de corte (ej. últimos 90 días o últimos N turnos), igual que ya se hizo en las ramas `cobros_received` y `payment_ledger` del mismo archivo. Si se necesita histórico completo, paginar con `.range()`.
```

```
ID: SUPA-005
SEVERIDAD: P2
AREA: Realtime — canal sin acotar (broadcast amplio)
ARCHIVO: src/components/dashboard/doctor-dashboard.tsx
LINEA: 571-601
DESCRIPCION: El canal `doctor-documents-${doctorId}` se suscribe a **todos** los INSERT de `patient_documents` en todo el esquema `nodo_clinica`, sin `filter` de Realtime (a diferencia del canal `doctor-appointments` en la misma función, línea 557-569, que sí filtra `doctor_id=eq.${doctorId}`, y del canal `waiting-${accessToken}` en waiting-room.tsx que filtra `access_token=eq...`). El filtrado por "¿este documento es de un turno de este médico?" se hace client-side (`queueRef.current.some(...)`) después de recibir el payload completo por el socket.
EVIDENCIA: `.channel(\`doctor-documents-${doctorId}\`).on("postgres_changes", { event: "INSERT", schema: "nodo_clinica", table: "patient_documents" }, async (payload) => { ... const belongsToDoctor = queueRef.current.some(p => p.appointmentId === doc.appointment_id); if (!belongsToDoctor) return; ... })` — sin `filter` en la config del `.on(...)`.
ESCENARIO PARA REPRODUCIR: Con dos médicos conectados simultáneamente al dashboard (`doctor-dashboard.tsx`), un paciente de UNO de ellos sube un documento — el otro médico también recibe el evento por su socket (aunque lo descarte sin mostrarlo).
IMPACTO: Cada subida de documento de cualquier paciente de la organización se retransmite a **todos los médicos conectados**, no solo al que corresponde. Nota de alcance: la policy RLS `staff_select_patient_documents` (`org_id = current_org_id()`) ya permite a cualquier staff leer documentos de toda la org por SELECT normal, así que esto no abre una vía de acceso nueva más allá de lo que RLS ya permite — es un hallazgo de **costo/eficiencia de Realtime**, no de fuga de datos entre organizaciones. A más médicos conectados y más documentos subidos por día, el fan-out de mensajes Realtime crece de forma innecesaria (cada médico procesa eventos que nunca le sirven).
PROBABILIDAD: media (escala con cantidad de médicos concurrentes por organización)
RECOMENDACION: Agregar `filter` al `.on("postgres_changes", ...)` acotando por `doctor_id`/`org_id` si la tabla lo permite en el filtro de Realtime, o mover la lógica de "pertenece a este médico" a un evento server-side más granular (ej. Broadcast dirigido) en vez de Postgres Changes sin filtrar.
```

```
ID: SUPA-006
SEVERIDAD: P3
AREA: Polling agregado — costo de sesión activa
ARCHIVO: src/components/layout/medico-admin-layout.tsx
LINEA: 207-229
DESCRIPCION: El layout raíz de todo el panel del médico (envuelve cada página del admin) mantiene DOS `setInterval` activos durante toda la sesión: `refreshCobrosUnread` cada 10s (además dispara en focus/visibilitychange) y `pingInterconsultPresence` cada 30s. Sumado a otros pollers independientes en componentes hijos que pueden montarse en simultáneo (`use-clinic-notifications.ts` 60s, `nodo-chat-bell.tsx` 20s, `use-medico-home-agenda.ts` 30s, `doctor-cobros-list.tsx`/`doctor-payments-ledger.tsx`/`doctor-pending-payments-panel.tsx` 180s cada uno), una sesión de médico activa puede tener hasta 7-8 timers de polling corriendo en paralelo, cada uno pegándole a un endpoint propio.
EVIDENCIA: `medico-admin-layout.tsx:210: const interval = setInterval(refreshCobrosUnread, 10_000);` y `:227: const interval = setInterval(() => clinicApi.pingInterconsultPresence(), 30_000);` — ambos a nivel de layout, no de página, por lo que corren durante toda la sesión sin importar en qué pantalla esté el médico.
ESCENARIO PARA REPRODUCIR: Dejar abierta una pestaña logueada como médico y observar la pestaña Network — se ven requests a `getCobrosUnreadCount` cada 10s y a `pingInterconsultPresence` cada 30s de forma indefinida mientras la sesión esté abierta, sin importar la pantalla.
IMPACTO: Con pocos médicos concurrentes el costo es insignificante. Al escalar a decenas/cientos de médicos con sesión abierta simultánea, el poll de 10s por sí solo genera un piso de tráfico constante hacia la API/DB proporcional a médicos-conectados / 10s, independiente de si hay actividad real. No es crítico pero conviene revisarlo antes de dimensionar infraestructura para producción con muchos usuarios concurrentes.
PROBABILIDAD: baja hoy, crece con la base de usuarios concurrentes
RECOMENDACION: Evaluar reemplazar el poll de `refreshCobrosUnread` (10s) por un canal Realtime acotado (similar al patrón ya usado en `doctor-dashboard.tsx` para turnos), y subir el intervalo de `pingInterconsultPresence` si la granularidad de "presencia" no requiere 30s. No es urgente para el volumen actual.
```

```
ID: SUPA-007
SEVERIDAD: P3
AREA: Query anti-pattern — over-fetching de columnas
ARCHIVO: src/lib/clinic/db/*.ts, src/app/api/clinic/**/*.ts (múltiples)
LINEA: N/A (patrón repetido, ~57 ocurrencias)
DESCRIPCION: `select("*")` está presente en 57 lugares del código (`rg "select\\('\\*'\\)|select\\(\"\\*\"\\)"` sobre `src/`), incluyendo tablas con columnas sensibles y/o grandes: `patients` (DNI, contacto), `professionals` (con `office_settings(*)` anidado), `clinical_records`, `prescriptions`. La mayoría de los casos están acotados por `.eq("id", ...)` o `.maybeSingle()` sobre una sola fila, donde el impacto de over-fetch es marginal, pero varios están en listas (`appointments.select("*, patients(full_name), patient_documents(*)")`, `clinical-records.ts` líneas 40/80/115/157/228/258) donde cada fila trae todas las columnas de la tabla aunque el consumidor solo use 3-4 campos (confirmado leyendo los `.map()` posteriores en `route.ts`, que solo proyectan un subconjunto de campos al JSON de respuesta).
EVIDENCIA: `src/app/api/clinic/appointments/route.ts:380`: `.select("*, patients(full_name), patient_documents(*)")` seguido de un `.map()` que solo usa `apt.id, apt.payment_confirmed_at, apt.created_at, apt.scheduled_at, apt.payment_provider, ...` — no usa el resto de las ~25 columnas de `appointments`.
ESCENARIO PARA REPRODUCIR: Comparar las columnas de `AppointmentRow` (25 campos, `src/lib/clinic/db/appointments.ts:18-50`) contra los campos efectivamente devueltos en la respuesta JSON de `GET /api/clinic/appointments?scope=cobros_received`.
IMPACTO: Egress adicional por fila transferida de más (proporcional a filas × columnas no usadas). Con el volumen actual (decenas de filas) el costo es despreciable; a escala de producción con miles de turnos por organización, sumado a la falta de límites en algunos endpoints (ver SUPA-004), este patrón amplifica el costo de egress de Supabase.
PROBABILIDAD: baja impacto hoy, se amplifica junto con el crecimiento de datos
RECOMENDACION: No es necesario tocar los casos de una sola fila (`.maybeSingle()` por `id`). Priorizar reemplazar `select("*")` por listas explícitas de columnas en los endpoints de listado de alto volumen esperado (turnos, prescripciones, cobros).
```

```
ID: SUPA-008
SEVERIDAD: P3
AREA: RLS — políticas permisivas duplicadas
ARCHIVO: (Supabase — tablas `nodo_clinica.appointments`, `patient_documents`, `patients`, `professionals`, `clinical_records`, `clinical_notes`, `prescriptions`, `study_orders`, `soap_summaries`, `transcriptions`, `office_settings`, `doctor_notifications`, `patient_health_profiles`)
LINEA: N/A
DESCRIPCION: 24 lints `multiple_permissive_policies` en `nodo_clinica`: varias tablas tienen 2-3 policies PERMISSIVE separadas para la misma combinación rol+acción (ej. `patient_select_appointments` + `staff_select_appointments`, ambas SELECT para `authenticated`), en vez de una sola policy con condición combinada (OR). Esto no es un problema de seguridad (el resultado final de acceso es el mismo), pero cada policy adicional es una subquery extra que Postgres evalúa por fila en el plan.
EVIDENCIA: `get_advisors(performance)` → `{"schema":"nodo_clinica","name":"appointments","fkey_name":null}` con detail: `Table nodo_clinica.appointments has multiple permissive policies for role authenticated for action SELECT. Policies include {patient_select_appointments,staff_select_appointments}`.
ESCENARIO PARA REPRODUCIR: `get_advisors(project_id, type="performance")` y filtrar `name == "multiple_permissive_policies" and metadata.schema == "nodo_clinica"`.
IMPACTO: Overhead de evaluación de RLS duplicado (2-3x subqueries por fila) en las tablas más consultadas del sistema (`appointments`, `patient_documents`, `patients`). Con el volumen actual no es medible; a escala, junto con SUPA-002 y SUPA-003, compone el costo de cada query sobre estas tablas.
PROBABILIDAD: baja impacto hoy, aumenta con volumen de filas evaluadas por policy
RECOMENDACION: Consolidar las policies redundantes por rol+acción en una única policy con condición `OR` combinada, siguiendo la guía de Supabase sobre RLS performance. No es bloqueante para producción inicial.
```

```
ID: SUPA-009
SEVERIDAD: P3
AREA: Cron — escritura fila por fila (no N+1 de lectura)
ARCHIVO: src/app/api/cron/appointment-reminders/route.ts
LINEA: 32-83
DESCRIPCION: La lectura inicial de turnos está bien resuelta (un solo `select` con joins a `patients` y `professionals!appointments_doctor_id_fkey(office_settings(...))`, sin N+1 de lectura). Pero dentro del `for (const apt of appointments ?? [])` se hace un `UPDATE ... .eq("id", apt.id)` individual por cada recordatorio enviado (línea 71-77), en vez de acumular los IDs y hacer un único `UPDATE ... WHERE id IN (...)` al final del loop (patrón que si está usado en la rama local del mismo archivo, línea 133-140, vía `idsToMark`).
EVIDENCIA: `for (const apt of appointments ?? []) { ... await supabase.from("appointments").update({ reminder_sent_at: ... }).eq("id", apt.id); sent++; }` — un roundtrip de escritura por turno procesado.
ESCENARIO PARA REPRODUCIR: Ejecutar el cron con N turnos elegibles para recordatorio en el mismo run — se observan N statements UPDATE individuales en los logs de Postgres en vez de 1.
IMPACTO: Bajo — es un cron de una vez al día (comentario en el propio archivo: "Hobby tier: cron runs once/day"), y el volumen de recordatorios por corrida está naturalmente acotado a los turnos del día. No es un problema de escala real, solo una oportunidad de limpieza menor.
PROBABILIDAD: baja
RECOMENDACION: Si se quiere prolijidad, batchear el update final igual que ya se hace en `runLocalReminders` (línea 133-140) con `idsToMark` + un único `update .in("id", idsToMark)`. No urgente.
```

```
ID: SUPA-010
SEVERIDAD: P3
AREA: Índices no utilizados (posible falso positivo por bajo volumen)
ARCHIVO: (Supabase — nodo_clinica.appointments, nodo_clinica.prescriptions, nodo_clinica.in_person_availability, nodo_clinica.account_activation_tokens)
LINEA: N/A
DESCRIPCION: El advisor reporta 6 índices sin uso en `nodo_clinica`: `idx_clinica_appointments_patient`, `account_activation_tokens_email_idx`, `idx_in_person_availability_org`, `idx_appointments_type`, `idx_prescriptions_access_token`, `idx_prescriptions_patient_email`. Verificado en código que al menos `access_token` de `prescriptions` SÍ se usa como patrón de lookup (magic-link, mismo patrón que `appointments.access_token`), por lo que "sin uso" probablemente refleja el volumen casi nulo de tráfico real (6 filas en `prescriptions`, 13 en `appointments`) y no que el índice sea innecesario.
EVIDENCIA: `get_advisors(performance)` → 6 entradas `unused_index` en `nodo_clinica`. `list_tables` confirma `nodo_clinica.prescriptions` = 6 filas, `nodo_clinica.appointments` = 13 filas — volumen insuficiente para que el planner haya preferido nunca un index scan sobre un seq scan.
ESCENARIO PARA REPRODUCIR: `get_advisors(project_id, type="performance")` filtrado por `name == "unused_index" and metadata.schema == "nodo_clinica"`.
IMPACTO: Ninguno inmediato — no recomendar DROP de estos índices pre-producción, ya que varios protegen lookups por token de acceso público (seguridad + performance una vez que haya tráfico real). Se documenta para que el equipo no los elimine por seguir el advisor a ciegas.
PROBABILIDAD: N/A (no es un riesgo, es una aclaración anti-falso-positivo)
RECOMENDACION: No actuar sobre este advisor hasta tener tráfico real de producción que permita confirmar uso real u obsolescencia.
```

---

## 3. Patrones revisados y descartados (mitigados o sin evidencia de problema)

Por transparencia, esto es lo que se buscó explícitamente y **no** generó un hallazgo, con la evidencia de por qué:

- **Realtime sin cleanup**: se revisaron los 2 archivos con `.channel(`/`.subscribe(` (`doctor-dashboard.tsx`, `waiting-room.tsx`) — los 4 canales (`doctor-appointments`, `doctor-documents-*`, `waiting-*`, `clinical-records-*`) tienen su `return () => supabase.removeChannel(...)` en el cleanup del `useEffect`. No hay leak de canales.
- **Polling + Realtime simultáneo sobre el mismo dato**: en `waiting-room.tsx` y `doctor-dashboard.tsx` el polling (`setInterval` cada 3000ms) solo corre cuando `dataSource === "local"` (modo demo sin Supabase); en modo `"supabase"` se usa exclusivamente Realtime. No conviven ambos mecanismos sobre el mismo dato en producción.
- **N+1 de lectura dentro de loops**: se buscó `for (const ...)`/`.forEach(` seguido de un `await ...from(...)` dentro del cuerpo, en todas las rutas de `src/app/api`. El único loop que toca la base de datos por iteración es el cron de recordatorios (ver SUPA-009), y es una escritura (UPDATE), no una lectura — no hay N+1 de SELECT detectado.
- **Storage — re-descargas**: el acceso a Supabase Storage (`src/app/api/clinic/documents/route.ts`) usa `createSignedUrl(...)` de corta duración (1h) en vez de descargar y re-servir el archivo desde el servidor — patrón correcto, no genera doble tráfico de egress por el mismo archivo.
- **Búsquedas sin debounce**: no se encontró un input de búsqueda server-bound sin debounce que dispare una query por tecla contra Supabase directamente (la lista de recetas con búsqueda, agregada en el commit reciente `85d9265f`, filtra client-side sobre datos ya cargados).

---

## 4. Estimación de impacto egress/costo

Con los datos actuales (decenas de filas por tabla clínica) el costo de egress de Supabase es marginal — ningún hallazgo de este documento tiene impacto medible en la facturación **hoy**. La estimación relevante es hacia adelante:

- **SUPA-004** (lista sin paginar) es el que más rápido escala mal: crece linealmente con el historial de turnos por médico, sin techo. Es el primer candidato a generar timeouts o picos de egress cuando un médico acumule cientos de turnos.
- **SUPA-002 + SUPA-003 + SUPA-008** combinados afectan el costo de CPU/tiempo de respuesta de Postgres (no egress de red) en las tablas más consultadas (`appointments`, `patient_documents`, `patients`) a medida que crecen en filas — el efecto es indirecto (compute de la instancia Postgres, no billing de egress per se).
- **SUPA-005** (Realtime sin filtro) y **SUPA-006** (polling agregado) son los que más laten en costo de **conexiones concurrentes / mensajes Realtime** y en tráfico HTTP constante — ambos escalan con la cantidad de médicos con sesión simultánea abierta, no con el volumen de datos.
- **SUPA-007** (over-fetch de columnas) es el de menor impacto individual, pero es transversal (57 ocurrencias) y compone con los demás.

Ninguno de estos hallazgos es bloqueante para un lanzamiento inicial con tráfico bajo/moderado; se recomienda revisitar esta lista cuando el producto tenga métricas reales de uso concurrente y volumen de filas.

---

## 5. Resumen de severidades

| Severidad | Cantidad |
|---|---|
| P0 | 0 |
| P1 | 0 |
| P2 | 4 (SUPA-002, SUPA-003, SUPA-004, SUPA-005) |
| P3 | 6 (SUPA-001, SUPA-006, SUPA-007, SUPA-008, SUPA-009, SUPA-010) |

No se encontraron hallazgos P0/P1 de infraestructura Supabase/PostgreSQL: no hay RLS deshabilitado en ninguna tabla de `nodo_clinica` (`rls_enabled: true` en las 25 tablas del esquema), no hay evidencia de fuga de datos entre organizaciones a nivel de query, y no hay N+1 de lectura real en el código de rutas API.
