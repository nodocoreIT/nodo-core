# Auditoría de Concurrencia y Condiciones de Carrera — Nodo Clínica

**Rol:** Especialista en concurrencia / race conditions
**Fecha:** 2026-08-29
**Alcance:** Reserva de turnos (doble reserva del mismo slot), cancelaciones concurrentes, transiciones de estado, confirmación de pago concurrente.
**Modo:** SOLO LECTURA. No se modificó código, migraciones, DB ni configuración.

---

## Pregunta central

> Si el Paciente A y el Paciente B reservan el MISMO médico + día + hora al mismo tiempo, ¿la base de datos garantiza que solo uno tenga éxito?

**Respuesta: NO.** No existe ninguna garantía a nivel de base de datos.

La reserva se resuelve enteramente en la capa de aplicación con un patrón **read-then-insert (TOCTOU)**: primero se hace un `SELECT` de los turnos existentes del médico, se filtra en JavaScript para detectar solapamiento, y luego se hace un `INSERT` — sin transacción, sin `SELECT ... FOR UPDATE`, sin RPC atómica, y sin constraint `UNIQUE`/`EXCLUDE` que respalde el chequeo. Dos requests simultáneos ejecutan el `SELECT` antes de que cualquiera de los dos `INSERT` sea visible al otro, por lo que ambos pasan la validación y ambos insertan.

### Evidencia a nivel DB (introspección en vivo, project_id `iprrlgmhpsxzyrejabtu`)

Constraints reales sobre `public.appointments`:

```
appointments_pkey            PRIMARY KEY (id)
appointments_access_token_key UNIQUE (access_token)
appointments_doctor_id_fkey  FOREIGN KEY (doctor_id) -> profiles(id)
appointments_patient_id_fkey FOREIGN KEY (patient_id) -> patients(id)
appointments_status_check    CHECK (status IN (...))
```

Índices reales:

```
appointments_pkey            (id)                 UNIQUE
appointments_access_token_key (access_token)      UNIQUE
idx_appointments_doctor      (doctor_id, status)  NO UNIQUE
idx_appointments_patient     (patient_id)         NO UNIQUE
idx_appointments_token       (access_token)
```

Triggers reales: solo `appointments_updated_at` (BEFORE UPDATE, setea `updated_at`). **No hay trigger BEFORE INSERT que valide el slot.**

Búsqueda en las 50 migraciones (`rg -i unique`): **no existe ninguna** `UNIQUE`/`EXCLUDE` sobre `(doctor_id, scheduled_at)` ni equivalente. El único `UNIQUE` relevante es sobre `access_token` (generado con `randomUUID()`, nunca colisiona).

Búsqueda de mecanismos atómicos (`rg "\.rpc\(|FOR UPDATE|serializable"` en `src/lib/clinic` y rutas de turnos): **cero resultados**. Toda la reserva es read-then-insert en el cliente Supabase.

---

## Hallazgos

```
ID: RACE-001
SEVERIDAD: P1
AREA: Concurrencia / Reserva de turnos
ARCHIVO: src/app/api/clinic/appointments/route.ts (+ src/lib/clinic/doctor-assign-appointment.ts)
LINEA: route.ts 963-998 y 1023-1051 ; doctor-assign 189-237 y 276-313
DESCRIPCION: La reserva de turnos no tiene ninguna garantía de unicidad a nivel de base de datos. Tanto el flujo del paciente (POST /api/clinic/appointments) como el del médico (doctorAssignAppointments) detectan el solapamiento con un SELECT + filtro en JS y luego insertan, sin transacción ni constraint que respalde el chequeo. Dos reservas simultáneas para el mismo doctor+slot pasan ambas la validación e insertan ambas.
EVIDENCIA:
  // route.ts (flujo paciente) — read-then-insert
  const { data: existingApts } = await supabase
    .from("appointments").select("id, scheduled_at, status, appointment_type")
    .eq("doctor_id", doctorId).neq("status", "cancelled");
  const conflictingApt = (existingApts ?? []).find((a) => { ... slotKeyFromIso(a.scheduled_at) === slotKey ... });
  if (conflictingApt) return NextResponse.json({ error: "Ese horario ya está reservado" }, { status: 409 });
  ...
  const { data: apt, error } = await createAppointment(supabase, { doctor_id, scheduled_at: when.toISOString(), ... });
  // createAppointment = supabase.from("appointments").insert(data)  — sin ON CONFLICT, sin tx
  // DB: NO existe UNIQUE(doctor_id, scheduled_at) (ver introspección arriba)
ESCENARIO PARA REPRODUCIR:
  1. Médico con slot libre el 2026-09-01 10:00.
  2. Paciente A y Paciente B (dos sesiones) envían POST /api/clinic/appointments con el mismo doctorId y scheduledAt en el mismo instante (o el mismo paciente hace doble-click / doble-tab / retry).
  3. Ambos requests ejecutan el SELECT antes de que cualquier INSERT sea visible -> conflictingApt = undefined en los dos.
  4. Ambos INSERT tienen éxito -> dos turnos "scheduled" para el mismo doctor+hora.
IMPACTO: Doble reserva del mismo horario. El médico recibe dos pacientes para el mismo turno; si ambos pagaron (MercadoPago o transferencia validada), hay cobro doble por un slot único y necesidad de reembolso manual. Corrompe la cola (queue_position) y la agenda. El mismo defecto permite doble-click/retry del propio paciente generando turnos duplicados.
PROBABILIDAD: media
RECOMENDACION: (NO implementar) Agregar una garantía a nivel DB. Opción robusta: constraint de exclusión sobre el rango temporal por médico usando btree_gist (EXCLUDE USING gist (doctor_id WITH =, tsrange(scheduled_at, scheduled_at + duración) WITH &&) WHERE status <> 'cancelled'). Alternativa mínima: UNIQUE parcial (doctor_id, scheduled_at) WHERE status <> 'cancelled', y mover la creación a una RPC/transacción que capture el error de constraint y devuelva 409. La validación en JS debe quedar solo como UX, nunca como única defensa.
```

```
ID: RACE-002
SEVERIDAD: P2
AREA: Concurrencia / Reserva de turnos (ruta legacy sin guarda)
ARCHIVO: src/app/api/appointments/route.ts
LINEA: 7-73
DESCRIPCION: Existe una ruta POST /api/appointments (distinta de /api/clinic/appointments) que crea turnos con el service client SIN NINGÚN chequeo de solapamiento de slot y SIN requireAuth. Ni siquiera tiene el chequeo TOCTOU: inserta directo. Es un endpoint expuesto por el App Router aunque no se encontró caller en el frontend.
EVIDENCIA:
  export async function POST(request: NextRequest) {   // sin requireAuth
    const supabase = await createServiceClient();       // service role, bypassa RLS
    ...
    const { count } = await supabase.from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctorId).gte("scheduled_at", ...);   // solo para queue_position
    const { data: appointment, error } = await supabase.from("appointments")
      .insert({ patient_id, doctor_id, scheduled_at: scheduledAt, status: "scheduled", ... });
      // NO hay chequeo de conflicto de horario, NO hay UNIQUE en DB
ESCENARIO PARA REPRODUCIR:
  1. POST /api/appointments con doctorId + scheduledAt de un slot ya ocupado (o dos veces).
  2. Se inserta un turno superpuesto sin ninguna validación.
IMPACTO: Camino directo a doble reserva/turnos superpuestos, evitando incluso la validación TOCTOU del flujo principal. Al usar service client sin auth, cualquiera que conozca la ruta puede crear turnos. (El aspecto de autenticación corresponde al auditor de auth; desde concurrencia, agrava RACE-001 al no tener defensa alguna.)
PROBABILIDAD: baja
RECOMENDACION: (NO implementar) Eliminar la ruta si es legacy/no usada, o exigir requireAuth y hacerla pasar por el mismo camino de reserva con la garantía DB de RACE-001.
```

```
ID: RACE-003
SEVERIDAD: P2
AREA: Concurrencia / Lost update en cancelación
ARCHIVO: src/app/api/clinic/appointments/route.ts
LINEA: 1302-1343
DESCRIPCION: patientCancelAppointment lee el turno, valida en JS que status === "scheduled" y payment_status === "pending", y luego hace UPDATE ... eq("id", apt.id) SIN incluir el estado esperado en el WHERE. Entre la lectura y la escritura el médico puede mover el turno a "waiting"/"in_consultation" (o confirmar el pago); el UPDATE del paciente igual pisa el estado y lo deja "cancelled".
EVIDENCIA:
  const { data: apt } = await getAppointmentByToken(supabase, accessToken);
  if (apt.status !== "scheduled") return ...400;
  if (apt.payment_status !== "pending") return ...400;
  const { data: updated } = await supabase.from("appointments")
    .update({ status: "cancelled", payment_status: "pending", updated_at: ... })
    .eq("id", apt.id)          // <-- solo por id; sin .eq("status","scheduled") ni check de payment
    .select().single();
ESCENARIO PARA REPRODUCIR:
  1. Turno "scheduled" con pago pendiente.
  2. El paciente abre la pantalla de cancelar (lee estado scheduled).
  3. El médico confirma el pago / hace check-in -> status pasa a waiting/in_consultation.
  4. El paciente confirma cancelar -> el UPDATE por id pisa el estado y lo deja "cancelled" pese a estar en curso o ya pagado.
IMPACTO: Un turno en curso o ya pagado queda cancelado por una acción del paciente basada en un estado obsoleto. Inconsistencia de estado y potencial cobro que quedó sin turno.
PROBABILIDAD: baja
RECOMENDACION: (NO implementar) Hacer el UPDATE condicional al estado leído: agregar .eq("status","scheduled").eq("payment_status","pending") al WHERE y tratar 0 filas afectadas como conflicto (409). Idealmente encapsular en una transacción/RPC.
```

```
ID: RACE-004
SEVERIDAD: P3
AREA: Concurrencia / Confirmación de pago (webhook)
ARCHIVO: src/lib/clinic/appointment-payment.ts
LINEA: 112-188
DESCRIPCION: confirmAppointmentPaymentAndNotify re-lee payment_status y hace short-circuit si ya está "confirmed"/"waived", lo que evita corromper el importe. Pero el flag wasPending se calcula sobre la lectura obsoleta; dos webhooks de MercadoPago concurrentes (MP reintenta notificaciones) pueden leer ambos "pending", ambos pasar el guard y ambos disparar notificaciones/emails de confirmación. La fila de appointments queda consistente (confirmed), pero se envían notificaciones duplicadas.
EVIDENCIA:
  if (apt.payment_status === "confirmed" || apt.payment_status === "waived") return apt;
  const wasPending = apt.payment_status === "pending";   // lectura obsoleta
  const { data: updated } = await supabase.from("appointments")
    .update({ payment_status: "confirmed", ... }).eq("id", appointmentId)...;  // sin .eq("payment_status","pending")
  if (!wasPending) return updated;
  // ... envío de emails/notificaciones basado en wasPending
ESCENARIO PARA REPRODUCIR:
  1. MercadoPago envía dos webhooks (notificación + reintento) para el mismo payment aprobado casi simultáneos.
  2. Ambas invocaciones leen payment_status = "pending", ambas escriben confirmed y ambas envían email/notificación.
IMPACTO: Emails y notificaciones de confirmación duplicados al paciente/médico. Sin impacto monetario ni de datos en la fila. Molestia/UX.
PROBABILIDAD: media
RECOMENDACION: (NO implementar) Hacer el UPDATE condicional (.eq("payment_status","pending")) y usar el número de filas afectadas (no la lectura previa) para decidir si enviar notificaciones, garantizando disparo único.
```

```
ID: RACE-005
SEVERIDAD: P3
AREA: Concurrencia / Update de estado sin bloqueo optimista
ARCHIVO: src/app/api/clinic/appointments/route.ts
LINEA: 1640-1685
DESCRIPCION: El update genérico de estado (final del PATCH) hace updateAppointment(status) por id, sin verificar el estado previo ni versión. Dos dispositivos/tabs del médico (o médico + auto-check-in del GET por magic-link en la línea 133-137) pueden pisarse mutuamente las transiciones de estado sin detección de conflicto.
EVIDENCIA:
  if (status) { await updateAppointment(supabase, apt.id, apt.org_id, { status }); ... }
  // updateAppointment: .update({status,...}).eq("id",id).eq("org_id",orgId)  — last-write-wins
  // y en GET magic-link:
  await supabase.from("appointments").update({ status: "waiting" }).eq("id", apt.id);
ESCENARIO PARA REPRODUCIR:
  1. El médico marca "completed" en un dispositivo mientras el paciente carga la sala (GET) que auto-setea "waiting".
  2. Según el orden de llegada, un update pisa al otro (last-write-wins) sin error.
IMPACTO: Estado del turno inconsistente entre paciente y médico (p. ej. vuelve a "waiting" tras "completed"). Sin pérdida de datos clínicos; principalmente confusión en la cola/UX.
PROBABILIDAD: baja
RECOMENDACION: (NO implementar) Introducir transiciones de estado condicionadas al estado esperado (WHERE status = <esperado>) o una columna de versión, y tratar 0 filas como conflicto en vez de last-write-wins silencioso.
```

---

## Resumen de riesgo

| ID | Severidad | Riesgo |
|----|-----------|--------|
| RACE-001 | P1 | Doble reserva del mismo slot: no hay constraint DB; ambos flujos usan read-then-insert TOCTOU. |
| RACE-002 | P2 | Ruta legacy /api/appointments sin auth ni chequeo de conflicto: inserta turnos superpuestos directo. |
| RACE-003 | P2 | Lost update: cancelación del paciente pisa un turno que el médico movió/pagó (UPDATE solo por id). |
| RACE-004 | P3 | Webhooks MP concurrentes: notificaciones/emails de confirmación duplicados (fila queda consistente). |
| RACE-005 | P3 | Transiciones de estado last-write-wins sin bloqueo optimista. |

**Conclusión:** la respuesta a la pregunta central es NO — la unicidad de slot depende exclusivamente de un chequeo en aplicación que es vulnerable a TOCTOU. La corrección mínima imprescindible antes de producción es una garantía a nivel Postgres (constraint `EXCLUDE` con btree_gist sobre el rango temporal por médico, o `UNIQUE` parcial sobre `(doctor_id, scheduled_at)` con la creación dentro de una transacción/RPC que capture la violación). La validación en JavaScript debe conservarse solo como mejora de UX, nunca como defensa única.
