# Auditoría de Integridad de Datos Clínicos — Nodo Clínica

**Rol:** Especialista en integridad de datos clínicos
**Alcance:** Trazado de operaciones de escritura clínica multi‑paso (recetas, órdenes de estudio, informe/SOAP, notas, documentos) para verificar correctitud, atomicidad, idempotencia y correcta atribución de `patient_id` / `doctor_id`.
**Modo:** SOLO LECTURA. No se modificó código, migraciones, DB, RLS ni configuración.
**Fecha:** 2026-08-29
**Proyecto Supabase:** `iprrlgmhpsxzyrejabtu` (esquema activo de la app: `nodo_clinica`)

---

## Contexto técnico clave (verificado)

1. **La app escribe contra el esquema `nodo_clinica`, no `public`.** Tanto el cliente de sesión (`createAuthedClinicClient` y `createClient` vía `clinicaSupabaseClientOptions`) como el service client usan `db: { schema: "nodo_clinica" }`. Por lo tanto, las políticas RLS *estrictas* que existen en `public.*` (`doctor_id = auth.uid() AND is_assigned_doctor(patient_id)`) **están muertas** — las queries de la app nunca las tocan.

2. **Las políticas RLS de INSERT en `nodo_clinica.*` solo validan `org_id`.** Para `prescriptions`, `clinical_records`, `study_orders`, `soap_summaries`, `clinical_notes` la `WITH CHECK` de `staff_insert_*` es únicamente `(org_id = nodo_clinica.current_org_id())`. No validan `doctor_id`, ni asignación médico‑paciente, ni propiedad del turno. Además el rol de la política es `{authenticated}` (no filtra por rol de app: un `patient` también es `authenticated`).

3. **La app es single‑tenant** (`getClinicOrgId()` → un único `org_id`). En consecuencia `org_id = current_org_id()` **siempre pasa** para cualquier miembro del staff. La RLS de escritura no aporta ninguna barrera dentro de la clínica.

4. **`org_id` es `NOT NULL` sin default ni trigger** en las cinco tablas clínicas. Toda ruta que omita `org_id` en el INSERT falla por violación de `NOT NULL`.

5. **Los PDF se regeneran on‑the‑fly** desde `clinical_records.content` (ver `clinical-records/pdf/route.ts`); `prescriptions.pdf_url` siempre queda `null`. Por eso **no** hay riesgo de "PDF huérfano en Storage" para recetas/estudios/informes — el PDF es derivado, no almacenado. (Esto es correcto y se destaca como mitigación real.)

---

## Hallazgos

```
ID: CDA-001
SEVERIDAD: P1
AREA: Integridad clínica / atribución de autoría
ARCHIVO: src/app/api/clinic/prescriptions/route.ts (+ clinical-records/route.ts, clinic/study-orders/route.ts)
LINEA: prescriptions/route.ts:76-206
DESCRIPCION: doctor_id (y patient_id) provienen del body del cliente y solo se validan como "existe en el org". No se verifica que doctorId coincida con el médico autenticado. La RLS de nodo_clinica (staff_insert_*) solo chequea org_id, por lo que NO impide atribuir un documento clínico a otro médico ni a un paciente no asignado.
EVIDENCIA:
  // prescriptions/route.ts
  const { appointmentId, doctorId, patientId, medications, ... } = await request.json();
  ... supabase.from("professionals").select("id, full_name").eq("id", doctorId).eq("org_id", user.org_id) // solo "existe"
  await createPrescription(supabase, { org_id: user.org_id, doctor_id: doctorId, patient_id: patientId || null, ... });
  await createRecord(supabase, { doctor_id: doctorId, patient_id: patientId, record_type: "receta", ... });
  // RLS: staff_insert_prescriptions WITH CHECK (org_id = nodo_clinica.current_org_id())  ← no valida doctor_id ni asignación
ESCENARIO PARA REPRODUCIR: Médico A (autenticado) obtiene el professionals.id del Médico B (p.ej. vía /api/clinic/doctors) y hace POST /api/clinic/prescriptions con doctorId=B y patientId=cualquiera del org. La receta/registro se crea a nombre de B; el PDF regenerado lleva la matrícula y firma de B (clinical-records/pdf usa record.doctor_id).
IMPACTO: Falsificación de autoría clínica / receta emitida bajo la matrícula y firma de otro profesional. Riesgo médico‑legal grave (recetas, órdenes de estudio, informes y notas atribuibles a un médico que nunca los emitió; registros clínicos adjuntados a pacientes no tratados por ese médico).
PROBABILIDAD: media
RECOMENDACION: Derivar doctor_id SIEMPRE del servidor con resolveProfessional(authResult) e ignorar/rechazar el doctorId del cliente. Validar que patientId pertenezca a un paciente asignado al médico. Reintroducir en las políticas RLS de nodo_clinica la condición de autoría/asignación (doctor_id = professional del auth.uid() y is_assigned_doctor) para escritura.
```

```
ID: CDA-002
SEVERIDAD: P1
AREA: Pérdida de datos clínicos / borrado no autorizado
ARCHIVO: src/app/api/clinic/clinical-records/route.ts
LINEA: 129-159
DESCRIPCION: DELETE de un registro clínico usa el service client (bypass total de RLS), con scope solo por id + org_id, y un único gate de rol user.role === "doctor". No verifica que el registro pertenezca al médico ni a un paciente suyo. Cualquier médico del org puede borrar de forma permanente cualquier clinical_record de la clínica conociendo su id.
EVIDENCIA:
  if (user.role !== "doctor") return 403;
  // "El service role bypassa RLS; el scope por org_id ya lo hace deleteRecord."
  const serviceClient = (await createServiceClient()) as any;
  const { error } = await deleteRecord(serviceClient, id, user.org_id); // DELETE ... eq(id).eq(org_id)
ESCENARIO PARA REPRODUCIR: Médico A hace DELETE /api/clinic/clinical-records?id=<id de un registro del Médico B>. Como el service client ignora RLS y solo se filtra por id+org (siempre el mismo org), el registro se elimina.
IMPACTO: Borrado permanente de historia clínica ajena por cualquier médico. Pérdida irreversible de datos clínicos; sin papelera ni auditoría del borrado.
PROBABILIDAD: media
RECOMENDACION: No usar service client para DELETE iniciado por médico; o exigir que el registro sea del propio médico (doctor_id == professional del auth) y del paciente asignado antes de borrar. Considerar soft‑delete + audit_logs.
```

```
ID: CDA-003
SEVERIDAD: P1
AREA: Persistencia / atomicidad / auth
ARCHIVO: src/app/api/soap/generate/route.ts
LINEA: 6-55
DESCRIPCION: La ruta (a) NO tiene requireAuth y (b) hace upsert en nodo_clinica.soap_summaries SIN setear org_id. Como org_id es NOT NULL sin default, todo INSERT de un SOAP nuevo viola la restricción → la generación de SOAP se pierde (el resumen clínico se computa en Gemini pero nunca se persiste). Tampoco valida propiedad del appointment (appointmentId es input del cliente).
EVIDENCIA:
  export async function POST(request) {
    const { appointmentId, transcription, clinicalNotes } = await request.json(); // sin requireAuth
    const soap = await generateSoapSummary(...);
    await supabase.from("soap_summaries").upsert(
      { appointment_id: appointmentId, subjective, objective, analysis, plan }, // ← sin org_id
      { onConflict: "appointment_id" });
  }
  // schema: soap_summaries.org_id NOT NULL, sin default; RLS staff_insert WITH CHECK (org_id = current_org_id())
ESCENARIO PARA REPRODUCIR: En producción, generar SOAP desde soap-summary-panel.tsx (fetch a /api/soap/generate). El INSERT del row nuevo falla por org_id NOT NULL → 500; el SOAP no queda guardado. (Tablas hoy con 0 filas: coherente con que nunca persistió.)
IMPACTO: Pérdida del resumen SOAP (dato clínico) + endpoint de IA sin autenticación (costo/abuso de Gemini y envío de PHF por un caller anónimo). Feature efectivamente rota en prod.
PROBABILIDAD: alta
RECOMENDACION: Agregar requireAuth; resolver org_id del servidor y setearlo en el upsert; verificar que el appointment pertenezca al médico autenticado. Idealmente reutilizar createSOAP() (que ya modela org_id) en lugar del insert ad‑hoc.
```

```
ID: CDA-004
SEVERIDAD: P2
AREA: Atomicidad / persistencia parcial
ARCHIVO: src/app/api/clinic/prescriptions/route.ts
LINEA: 164-216
DESCRIPCION: La operación es una secuencia de escrituras independientes sin transacción: createPrescription() y luego createRecord(). El error de createRecord se IGNORA (se destructura solo `data`, no `error`). Si el espejo en clinical_records falla, la receta queda persistida sin su registro clínico → historial incompleto y downloadUrl null, pero la API responde 200.
EVIDENCIA:
  const { data: prescription, error: prescError } = await createPrescription(...);
  if (prescError || !prescription) return 500;
  ...
  const { data: createdRecord } = await createRecord(supabase, { ... record_type: "receta" }); // error NO chequeado
  record = createdRecord;
  return NextResponse.json({ id: prescription.id, clinical_record_id: record?.id, downloadUrl: record ? ... : null });
ESCENARIO PARA REPRODUCIR: Forzar fallo del segundo insert (p.ej. violación transitoria). Queda una prescription sin fila espejo en clinical_records; en "Mis recetas" la fuente "consultation" no la muestra y no hay PDF regenerable por record id.
IMPACTO: Persistencia parcial (receta sin registro clínico), historial clínico inconsistente, sin señal de error al usuario.
PROBABILIDAD: media
RECOMENDACION: Envolver ambos inserts en una función RPC/transacción de Postgres (todo o nada), o al menos chequear el error de createRecord y revertir/reportar. Aplicar el mismo patrón atómico a las demás escrituras multi‑paso.
```

```
ID: CDA-005
SEVERIDAD: P2
AREA: Atomicidad / persistencia parcial
ARCHIVO: src/app/api/clinic/study-orders/route.ts
LINEA: 59-124
DESCRIPCION: Igual patrón no atómico: createStudyOrder() y luego createRecord() cuyo error se IGNORA, seguido de un update a office_settings. El clinical_record es lo que habilita el PDF/descarga; si falla, queda la orden sin registro clínico ni PDF, y la API responde 200 con downloadUrl null.
EVIDENCIA:
  const { data: studyOrder, error: orderError } = await createStudyOrder(...);
  if (orderError || !studyOrder) return 500;
  const { data: record } = await createRecord(supabase, { ... record_type: "estudio" }); // error NO chequeado
  ...
  return NextResponse.json({ id: studyOrder.id, clinical_record_id: record?.id, downloadUrl: record ? ... : null });
ESCENARIO PARA REPRODUCIR: Fallo del insert de clinical_records tras crear la study_order. La orden existe pero no aparece como documento descargable/PDF ni en la historia del paciente.
IMPACTO: Orden de estudio sin su registro clínico/PDF; inconsistencia en la historia clínica; sin error visible.
PROBABILIDAD: media
RECOMENDACION: Transacción/RPC única para study_order + clinical_record; chequear el error de createRecord.
```

```
ID: CDA-006
SEVERIDAD: P2
AREA: Ruta legacy sin auth / escritura con IDs del cliente
ARCHIVO: src/app/api/study-orders/route.ts
LINEA: 4-31
DESCRIPCION: Ruta paralela a /api/clinic/study-orders SIN requireAuth. Inserta study_orders con appointmentId/doctorId/patientId tomados directamente del body y NO setea org_id. No crea el registro clínico espejo. Al omitir org_id (NOT NULL) el insert falla hoy, pero es una ruta muerta y peligrosa: sin autenticación, confía en input del cliente y quedaría explotable si alguna vez se agrega default a org_id.
EVIDENCIA:
  export async function POST(request) {
    const { appointmentId, doctorId, patientId, studies, notes } = await request.json(); // sin requireAuth
    const supabase = await createClient();
    await supabase.from("study_orders").insert({ appointment_id, doctor_id, patient_id, studies, notes }); // sin org_id
  }
ESCENARIO PARA REPRODUCIR: POST anónimo a /api/study-orders con IDs arbitrarios. Hoy 500 por org_id NOT NULL; sin esa barrera, permitiría inyectar órdenes con doctor_id/patient_id arbitrarios sin sesión.
IMPACTO: Superficie de escritura sin autenticación y con confianza total en el cliente; confusión/duplicación respecto de la ruta oficial.
PROBABILIDAD: baja
RECOMENDACION: Eliminar esta ruta legacy o unificarla con /api/clinic/study-orders (requireAuth + org_id del servidor + doctor_id derivado + registro espejo atómico).
```

```
ID: CDA-007
SEVERIDAD: P2
AREA: Sobrescritura de nota clínica / atribución
ARCHIVO: src/app/api/clinic/notes/route.ts
LINEA: 22-41
DESCRIPCION: PUT toma doctorId, appointmentId y content del cliente sin validarlos (no verifica que doctorId sea el médico autenticado, ni que el appointment le pertenezca, ni que content/appointmentId no sean vacíos). createNote() hace upsert onConflict appointment_id, con RLS que solo valida org_id. Cualquier médico del org puede sobrescribir la nota clínica de cualquier turno y fijar un doctor_id arbitrario.
EVIDENCIA:
  const { appointmentId, doctorId, content } = await request.json();
  await createNote(supabase, { appointment_id: appointmentId, org_id: user.org_id, doctor_id: doctorId, content });
  // createNote: upsert({ ... }, { onConflict: "appointment_id" }); RLS staff_update WITH CHECK (org_id = current_org_id())
ESCENARIO PARA REPRODUCIR: Médico A hace PUT /api/clinic/notes con appointmentId de un turno del Médico B y content nuevo. La nota clínica de B se sobrescribe; el doctor_id puede quedar apuntando a un tercero.
IMPACTO: Alteración/sobrescritura de notas clínicas ajenas y atribución incorrecta de autoría; sin control de propiedad del turno.
PROBABILIDAD: media
RECOMENDACION: Derivar doctor_id del auth; verificar que el appointment pertenezca al médico; validar payload; endurecer RLS de update para exigir autoría/propiedad del turno.
```

```
ID: CDA-008
SEVERIDAD: P3
AREA: Idempotencia / duplicados
ARCHIVO: src/app/api/clinic/prescriptions/route.ts, src/app/api/clinic/study-orders/route.ts
LINEA: prescriptions/route.ts:164-206
DESCRIPCION: No hay clave de idempotencia ni constraint único que evite duplicados. En prescriptions solo existen PK(id) y UNIQUE(access_token); en study_orders solo PK(id). Un doble submit o reintento del cliente genera dos recetas + dos clinical_records (o dos órdenes) equivalentes.
EVIDENCIA:
  -- pg_constraint (nodo_clinica):
  -- prescriptions: prescriptions_pkey (id), prescriptions_access_token_key (access_token)
  -- study_orders: study_orders_pkey (id)
  -- (sin unique sobre appointment_id/doctor_id/patient_id ni idempotency key)
ESCENARIO PARA REPRODUCIR: Doble click / reintento por timeout en el form de receta → dos POST → dos recetas idénticas y dos registros clínicos.
IMPACTO: Recetas/órdenes duplicadas en la historia del paciente; ruido y potencial confusión clínica.
PROBABILIDAD: media
RECOMENDACION: Aceptar un idempotency key del cliente (o hash de payload+appointment+ventana temporal) y deduplicar; deshabilitar el botón durante el submit no alcanza como garantía.
```

```
ID: CDA-009
SEVERIDAD: P3
AREA: Endpoint de IA sin auth / PHI / costo
ARCHIVO: src/app/api/clinic/clinical-report/generate/route.ts
LINEA: 4-54
DESCRIPCION: Genera el informe clínico vía Gemini sin requireAuth. No escribe en DB, pero es un proxy de IA abierto: cualquiera puede invocarlo enviando nombre de paciente, dictado y notas (PHI provista por el caller) y consumir cuota/costo de Gemini.
EVIDENCIA:
  export async function POST(request) {
    const body = await request.json(); // sin requireAuth
    const result = await generateClinicalReport({ dictation, transcription, clinicalNotes, patientName, doctorName, ... });
    return NextResponse.json(result);
  }
ESCENARIO PARA REPRODUCIR: POST anónimo a /api/clinic/clinical-report/generate con payload arbitrario → respuesta de IA, consumiendo cuota.
IMPACTO: Abuso de costo de IA y envío de PHI a un tercero por un caller no autenticado.
PROBABILIDAD: baja
RECOMENDACION: Agregar requireAuth y limitar a médicos aprobados; rate‑limit.
```

---

## Resumen de severidades

| ID | Sev | Área | Estado |
|----|-----|------|--------|
| CDA-001 | P1 | Atribución de autoría (doctor_id/patient_id del cliente, RLS solo valida org_id) | Confirmado |
| CDA-002 | P1 | Borrado no autorizado de historia clínica vía service client | Confirmado |
| CDA-003 | P1 | SOAP sin auth y sin org_id → no persiste (data loss) | Confirmado |
| CDA-004 | P2 | Receta no atómica; error de espejo ignorado | Confirmado |
| CDA-005 | P2 | Orden de estudio no atómica; error de espejo ignorado | Confirmado |
| CDA-006 | P2 | Ruta legacy /api/study-orders sin auth ni org_id | Confirmado |
| CDA-007 | P2 | Sobrescritura de nota clínica + doctor_id arbitrario | Confirmado |
| CDA-008 | P3 | Sin idempotencia → recetas/órdenes duplicadas | Confirmado |
| CDA-009 | P3 | clinical-report/generate sin auth (PHI/costo) | Confirmado |

## Mitigaciones reales observadas (no son hallazgos)

- **PDF derivado, no almacenado:** recetas/estudios/informes regeneran el PDF desde `clinical_records.content` on‑demand (`clinical-records/pdf/route.ts`), por lo que no existe riesgo de PDF huérfano en Storage ni de "record sin PDF".
- **Upload de documentos con cleanup:** en `documents/route.ts`, si el INSERT de metadata falla tras subir a Storage, el archivo se elimina (`serviceClient.storage...remove`), evitando blobs huérfanos.
- **Snapshot de institución en la receta:** `institution_snapshot` se congela al emitir, así una edición posterior de la institución no reescribe recetas ya emitidas.
