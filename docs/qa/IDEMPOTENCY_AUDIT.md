# Auditoría de Idempotencia — Nodo Clínica

**Rol:** Especialista en idempotencia
**Alcance:** Acciones críticas (crear turno, pagar, confirmar pago, reembolsar, crear receta, emitir estudio, guardar informe, finalizar consulta, subir documento, enviar email, procesar webhook).
**Modo:** Solo lectura. Sin cambios de código/DB.
**Fecha:** 2026-08-29
**Base de datos:** NodoCore (`iprrlgmhpsxzyrejabtu`), esquema `public`.

---

## Resumen ejecutivo

La mayoría de las acciones de **cambio de estado sobre una fila existente** están correctamente protegidas: guardas de transición (`payment_status === "confirmed"` → early return), constraints `UNIQUE(appointment_id)` en `soap_summaries`, `clinical_notes` y `transcriptions`, y `X-Idempotency-Key` en el reembolso de Mercado Pago. Esas acciones son idempotentes.

El riesgo real está en las acciones de **creación** y en **suscripciones recurrentes (Preapproval)**, donde NO existe idempotency key, ni constraint de unicidad de negocio, ni chequeo de "ya existe una suscripción activa". Un doble click, un reintento por timeout, o dos pestañas de checkout producen:

- **Doble suscripción de Mercado Pago** (cobro recurrente duplicado) — el hallazgo más grave.
- **Turnos duplicados** en el mismo slot (los chequeos de conflicto son read-then-insert sin constraint que los respalde).
- **Recetas / órdenes de estudio duplicadas** y filas duplicadas en `clinical_records` (esta tabla NO tiene constraint de unicidad).

Las guardas de estado en el webhook de pago hacen que los **reintentos secuenciales** de Mercado Pago sean seguros a nivel de dato; el punto débil es la **concurrencia real** y las **acciones de creación disparadas por el usuario**.

---

## Matriz de idempotencia por acción

| Acción | ¿Idempotente? | Mecanismo / Riesgo | Hallazgo |
|---|---|---|---|
| Crear turno (`POST /appointments`) | ❌ No | Chequeo de slot/conflicto read-then-insert; sin `UNIQUE(doctor_id, scheduled_at)` ni idempotency key | IDEM-003 |
| Asignar turno médico (`POST /appointments/assign`) | ❌ No | Mismo patrón TOCTOU en `doctorAssignAppointments` | IDEM-003 |
| Iniciar pago turno (checkout MP) | ⚠️ Parcial | Crea nueva preference cada vez y pisa `mercadopago_preference_id`; MP captura el pago una sola vez, no hay doble cobro del paciente | — (bajo impacto) |
| Confirmar pago turno (webhook / `confirmPayment`) | ✅ Sí (dato) / ⚠️ efectos | Guarda `payment_status in (confirmed, waived)` → early return. Reintentos secuenciales seguros. Bajo concurrencia real puede duplicar el email al paciente (la notificación al médico sí deduplica) | IDEM-005 |
| Reembolsar (MP) | ✅ Sí | `refundPayment` envía `X-Idempotency-Key: paymentId`; guarda `payment_status === "confirmed"` | — (mitigado) |
| Reembolso manual (transferencia) | ⚠️ Parcial | Guarda `status === "cancelled"` + `payment_provider === "transfer"`, pero sin guarda de `payment_status !== "refunded"`; re-ejecuta el update (idempotente en el dato, solo re-sella `refunded_at`) | — (bajo impacto) |
| Suscripción médico Nodo (`POST /subscription/checkout`) | ❌ No | Crea un Preapproval nuevo cada POST, pisa `mercadopago_preapproval_id`, no cancela ni verifica el anterior | **IDEM-001** |
| Suscripción paciente (`POST /patient-subscription/checkout`) | ❌ No | Igual patrón; el guard `subscription_plan === planId` solo aplica después de la confirmación | IDEM-002 |
| Crear receta (`POST /prescriptions`) | ❌ No | Sin dedupe ni constraint; duplica `prescriptions` y `clinical_records` (receta) | IDEM-004 |
| Emitir orden de estudio (`POST /study-orders`) | ❌ No | Sin dedupe ni constraint; duplica `study_orders` y `clinical_records` (estudio) | IDEM-004 |
| Enviar/reenviar magic link de receta (`.../send`) | ✅ Sí (por diseño) | Reemite token nuevo cada vez; el reenvío es intencional | — |
| Guardar informe / finalizar consulta (SOAP, notas, transcripción) | ✅ Sí | `UNIQUE(appointment_id)` en `soap_summaries`, `clinical_notes`, `transcriptions` | — |
| Subir documento (`POST /documents`) | ❌ No (por diseño) | Cada upload crea una fila nueva (path con `Date.now()`); duplicados posibles pero de bajo impacto clínico | — (bajo impacto) |
| Enviar recordatorio (cron) | ✅ Sí | Filtra `reminder_sent_at IS null` y sella tras enviar | — |

---

## Hallazgos

```
ID: IDEM-001
SEVERIDAD: P1
AREA: Pagos / Suscripciones recurrentes (Preapproval)
ARCHIVO: src/app/api/clinic/subscription/checkout/route.ts
LINEA: 44-92
DESCRIPCION: El POST que inicia la suscripción del médico a Nodo crea un nuevo
Preapproval de Mercado Pago en CADA llamada, sin verificar si el médico ya tiene
un `mercadopago_preapproval_id` activo y sin cancelar el anterior. El id nuevo
PISA al anterior en `professionals.mercadopago_preapproval_id`, de modo que si
dos preapprovals llegan a autorizarse, el webhook solo actualiza el que quedó
guardado; el primero sigue cobrando de forma recurrente sin quedar reflejado en
la app.
EVIDENCIA:
  // route.ts (POST) — sin chequeo de suscripción existente:
  const result = await createNodoSubscriptionPreapproval({ plan, payerEmail: professional.email, externalReference: professional.id, ... });
  ...
  await supabase.from("professionals")
    .update({ mercadopago_preapproval_id: result.preapprovalId, subscription_plan: plan.id })
    .eq("id", professional.id);
  // handle-subscription-webhook.ts solo matchea por el id guardado:
  .eq("mercadopago_preapproval_id", preapprovalId)
ESCENARIO PARA REPRODUCIR: El médico abre el checkout de suscripción, no lo
completa (o hace doble click / reintento por timeout), vuelve a iniciarlo y
completa la autorización en ambos links de MP. Quedan dos Preapproval activos;
la app solo "ve" el último → cobro recurrente duplicado invisible.
IMPACTO: Doble cobro RECURRENTE mensual/anual al médico. El cargo huérfano no se
puede cancelar desde la app porque su id no quedó persistido. Requiere soporte
manual en el panel de Mercado Pago.
PROBABILIDAD: media
RECOMENDACION: Antes de crear el Preapproval, leer `mercadopago_preapproval_id`
actual; si existe y está `authorized`, cancelarlo (cancelPreapproval) o reusarlo
/ rechazar la operación. Alternativamente usar un external_reference determinista
y un lock por médico. No implementar aquí.
```

```
ID: IDEM-002
SEVERIDAD: P2
AREA: Pagos / Suscripciones recurrentes (Preapproval)
ARCHIVO: src/app/api/clinic/patient-subscription/checkout/route.ts
LINEA: 147-195
DESCRIPCION: Mismo patrón que IDEM-001 para la suscripción del paciente. Existe
un guard `if (patient.subscription_plan === planId)` pero ese campo recién pasa a
"pago" DESPUÉS de que el webhook confirma la autorización; entre el inicio del
checkout y la confirmación, POSTs repetidos crean múltiples Preapproval y pisan
`mercadopago_preapproval_id`.
EVIDENCIA:
  if (patient.subscription_plan === planId) {
    return NextResponse.json({ error: "Ya tenés activo este plan." }, { status: 400 });
  }
  // ...pero subscription_plan sigue en "gratuito" hasta el webhook:
  preapproval = await createPreapproval({ ..., externalReference: patient.id });
  await svc.from("patients").update({ mercadopago_preapproval_id: preapproval.id }).eq("id", patient.id);
ESCENARIO PARA REPRODUCIR: Paciente en plan gratuito hace doble click en
"Suscribirme" o reintenta tras un timeout; se generan dos Preapproval, autoriza
ambos → doble cobro recurrente; el primero queda huérfano.
IMPACTO: Doble cobro recurrente al paciente; cargo huérfano no visible/cancelable
desde la app.
PROBABILIDAD: media-baja
RECOMENDACION: Chequear/cancelar `mercadopago_preapproval_id` previo antes de
crear uno nuevo; deduplicar por `pending` preapproval reciente del mismo paciente.
No implementar aquí.
```

```
ID: IDEM-003
SEVERIDAD: P2
AREA: Turnos / Creación concurrente
ARCHIVO: src/app/api/clinic/appointments/route.ts
LINEA: 963-1051 (POST) ; también src/lib/clinic/doctor-assign-appointment.ts:189-286
DESCRIPCION: La creación de turnos valida disponibilidad de slot y conflictos con
una LECTURA previa (`existingApts`) seguida de un INSERT, sin transacción ni
constraint de unicidad de negocio. La tabla `appointments` solo tiene UNIQUE en
`id` y `access_token` (verificado en pg_constraint) — NO hay
`UNIQUE(doctor_id, scheduled_at)`. Dos requests concurrentes (o doble click)
para el mismo slot pasan ambos el chequeo antes de que cualquiera confirme, e
insertan dos turnos.
EVIDENCIA:
  // Verificación pg_constraint sobre appointments:
  //   appointments_pkey PRIMARY KEY (id)
  //   appointments_access_token_key UNIQUE (access_token)
  // (no existe constraint sobre doctor_id + scheduled_at)
  const { data: existingApts } = await supabase.from("appointments")
    .select("id, scheduled_at, status, appointment_type").eq("doctor_id", doctorId).neq("status", "cancelled");
  const conflictingApt = (existingApts ?? []).find((a) => { ... slotKeyFromIso(a.scheduled_at) === slotKey ... });
  if (conflictingApt) return NextResponse.json({ error: "Ese horario ya está reservado" }, { status: 409 });
  // ...luego INSERT sin re-chequeo atómico:
  const { data: apt } = await createAppointment(supabase, { ... scheduled_at: when.toISOString() ... });
ESCENARIO PARA REPRODUCIR: El paciente hace doble click en "Reservar", o el
frontend reintenta por timeout de red; llegan dos POST casi simultáneos → se
crean dos turnos en el mismo horario (y con MP, dos checkouts).
IMPACTO: Slot doble-reservado, turnos duplicados en la agenda del médico,
confusión de cola/pago. Con MP el paciente puede terminar con dos preferences.
PROBABILIDAD: media
RECOMENDACION: Agregar un índice único parcial (p.ej. sobre `(doctor_id,
scheduled_at)` para turnos no cancelados) que respalde el chequeo aplicativo, o
un idempotency key por (patient_id, doctor_id, scheduled_at). No implementar aquí.
```

```
ID: IDEM-004
SEVERIDAD: P2
AREA: Recetas y órdenes de estudio / Creación duplicada
ARCHIVO: src/app/api/clinic/prescriptions/route.ts ; src/app/api/clinic/study-orders/route.ts
LINEA: prescriptions 70-216 ; study-orders 5-125
DESCRIPCION: Ambos POST crean una fila nueva en cada request, sin dedupe, sin
idempotency key y sin constraint de unicidad. Además espejan el registro en
`clinical_records`, tabla que NO tiene ninguna constraint UNIQUE (verificado en
pg_constraint: solo `clinical_records_pkey`). Un doble click o reintento produce
recetas/estudios duplicados y entradas duplicadas en el historial clínico del
paciente. En recetas standalone pagas, cada duplicado genera su propio link de
checkout MP.
EVIDENCIA:
  // pg_constraint(clinical_records): solo clinical_records_pkey PRIMARY KEY (id)
  // prescriptions/route.ts:
  const { data: prescription } = await createPrescription(supabase, { ...medications... });
  // luego, sin chequear duplicados:
  const { data: createdRecord } = await createRecord(supabase, { record_type: "receta", ... });
  // study-orders/route.ts:
  const { data: studyOrder } = await createStudyOrder(supabase, { ...studies... });
  const { data: record } = await createRecord(supabase, { record_type: "estudio", ... });
ESCENARIO PARA REPRODUCIR: En la consulta en vivo el médico hace doble click en
"Emitir receta"/"Solicitar estudio", o el request se reintenta por timeout → dos
recetas/órdenes idénticas + dos filas en `clinical_records`, visibles en el
historial del paciente.
IMPACTO: Documentos clínicos duplicados en el historial del paciente; en recetas
pagas, múltiples borradores cobrables; ruido en la lista de recetas del médico.
PROBABILIDAD: media
RECOMENDACION: Deduplicar por (appointment_id, doctor_id, hash de medications/
studies) en una ventana corta, o exigir idempotency key del cliente, o constraint
única de negocio. No implementar aquí.
```

```
ID: IDEM-005
SEVERIDAD: P3
AREA: Webhook de pago / Efectos colaterales bajo concurrencia
ARCHIVO: src/lib/clinic/appointment-payment.ts
LINEA: 120-238
DESCRIPCION: `confirmAppointmentPaymentAndNotify` protege el DATO con una guarda
read-then-write (`payment_status in (confirmed, waived)` → early return), lo que
hace SEGUROS los reintentos SECUENCIALES del webhook de Mercado Pago. Sin
embargo, la decisión de disparar efectos colaterales depende de `wasPending`
calculado sobre esa misma lectura previa: bajo concurrencia real (dos entregas
del webhook procesadas en paralelo) ambas pueden leer `pending` y enviar el email
de confirmación al paciente dos veces. La notificación al médico SÍ deduplica
por `appointmentId/mercadopagoPaymentId`, y no hay doble captura de dinero (MP
cobra una sola vez), por lo que el impacto es acotado.
EVIDENCIA:
  if (apt.payment_status === "confirmed" || apt.payment_status === "waived") return apt;
  const wasPending = apt.payment_status === "pending";
  const { data: updated } = await supabase.from("appointments").update({ payment_status: "confirmed", ... }).eq("id", appointmentId)...;
  if (!wasPending) return updated;
  // efectos colaterales sin guarda transaccional:
  sendAppointmentConfirmationEmail({ ... });   // no deduplicado
  await notifyDoctorMercadoPagoPayment({ ... }); // sí deduplicado internamente
ESCENARIO PARA REPRODUCIR: Mercado Pago entrega el mismo evento de pago dos veces
casi en simultáneo (comportamiento habitual de reintento). Si ambas ejecuciones
leen la fila antes del UPDATE, el paciente recibe dos emails de confirmación.
IMPACTO: Email de confirmación duplicado al paciente. Sin impacto económico ni de
integridad de datos.
PROBABILIDAD: baja
RECOMENDACION: Hacer atómica la transición (UPDATE ... WHERE payment_status =
'pending' y ramificar los efectos según filas afectadas), o registrar el evento
de webhook en una tabla de idempotencia (payment_id procesado). No implementar aquí.
```

---

## Acciones verificadas como idempotentes (sin hallazgo)

- **Reembolso MP** (`src/lib/clinic/appointment-refund.ts` + `client.ts:118-136`): `refundPayment` envía `X-Idempotency-Key: paymentId`; Mercado Pago deduplica el reembolso. Reintentos seguros. No se reporta.
- **Guardado de informe / finalización de consulta**: `soap_summaries`, `clinical_notes` y `transcriptions` tienen `UNIQUE(appointment_id)` (verificado en pg_constraint), garantizando una fila por turno.
- **Recordatorios (cron)**: filtra `reminder_sent_at IS null` y sella tras el envío.
- **Confirmación de pago a nivel de dato** (turno y receta): guarda de transición de estado que hace idempotentes los reintentos secuenciales del webhook.

---

## Notas de método

- Constraints/índices verificados con SELECT de solo lectura sobre `pg_constraint` y `pg_indexes` (esquema `public`). Las tablas clínicas están en 0 filas (pre-producción), por lo que no se tocó ningún dato real.
- No se ejecutó la app ni se corrieron builds. Sin escrituras a DB/almacenamiento.
