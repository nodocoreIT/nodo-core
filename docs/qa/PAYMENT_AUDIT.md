# Auditoría de Pagos — Nodo Clínica (MercadoPago end-to-end)

**Especialista:** Sistemas de pagos
**Alcance:** `src/lib/mercadopago/*`, rutas `api/clinic/mercadopago/*`, `api/webhooks/mercadopago`, `api/clinic/subscription/checkout`, `api/clinic/patient-subscription/checkout`, `api/clinic/prescriptions/mercadopago`, reembolsos (`src/lib/clinic/appointment-refund.ts`) y validación de comprobantes de transferencia por IA (`api/clinic/payment-receipt/validate`).
**Modo:** SOLO LECTURA. No se modificó código, base ni configuración.
**Fecha:** 2026-08-29

---

## Resumen ejecutivo

El diseño de pagos es sólido en los puntos más críticos: **los montos NUNCA se toman del cliente** (la preferencia de checkout se crea server-side con el honorario de `office_settings` / el precio de `nodo_core.planes` / `prescriptions.price_amount`), el `external_reference` lo fija el servidor y lo devuelve MercadoPago (no es manipulable), la confirmación de pago siempre re-consulta el pago real contra el token OAuth del médico dueño (`getPayment`), los tokens OAuth están aislados por profesional en `payment_credentials` (service-role + RLS), el reembolso en MP usa `X-Idempotency-Key` y hay guardas de estado que evitan doble reembolso, y la firma del webhook está correctamente implementada (HMAC-SHA256 con `timingSafeEqual`).

Sin embargo hay **hallazgos reales que deben resolverse antes de producción**:

- **P1 — IDOR en reembolsos:** las acciones `refundAppointmentMercadoPago` y `markAppointmentRefundedManually` solo verifican `role !== "patient"` pero NO que el turno pertenezca al médico autenticado. Un médico puede disparar un reembolso real (movimiento de dinero) sobre el turno de OTRO médico.
- **P1 — Firma del webhook fail-open:** la verificación de firma se omite por completo si `MERCADOPAGO_WEBHOOK_SECRET` no está seteada. Es un patrón fail-open dependiente de una env var manual.
- **P2 — Idempotencia no atómica en la confirmación:** `confirmAppointmentPaymentAndNotify` (y su gemela de recetas) hacen read-then-write sin guarda condicional de estado; el webhook y el fallback de `sync` disparan en paralelo → notificaciones al médico y mails de confirmación duplicados.
- **P2 — Auto-aprobación de transferencia por IA sobre imagen subida por el propio paciente:** el paciente confirma su propio pago; la imagen es falsificable y no hay verificación bancaria. Se amplifica si `CLINIC_RELAX_PAYMENT_VALIDATION=true`.
- **P3 — Doble cobro real no reconciliado:** si el paciente paga dos links de preferencia del mismo turno, el segundo pago se cobra en MP pero el sistema lo ignora (no lo registra ni lo reembolsa).
- **P3 — Endpoint `oauth/diagnose` sin autenticación** expone `clientId`/`redirectUri` y permite gatillar llamadas a MP.

---

## Hallazgos

```
ID: PAY-001
SEVERIDAD: P1
AREA: Reembolsos / Autorización (IDOR)
ARCHIVO: src/app/api/clinic/appointments/route.ts (+ src/lib/clinic/appointment-refund.ts)
LINEA: route.ts 1600-1620 ; appointment-refund.ts 9-33 y 75-92
DESCRIPCION: Las acciones POST "refundAppointmentMercadoPago" y "markAppointmentRefundedManually" solo validan que el usuario NO sea paciente (`if (user.role === "patient") return 403`). No se resuelve el profesional autenticado ni se verifica que el `appointmentId` pertenezca a él. `refundAppointmentViaMercadoPago(appointmentId)` carga el turno solo por id (`.eq("id", appointmentId)`, sin `.eq("doctor_id", ...)`) y reembolsa usando el token de MP del médico dueño del turno (`getDoctorMercadoPagoAccessToken(apt.doctor_id)`). Contrasta con la acción hermana `doctorDeleteAppointment` (líneas 1561-1597), que SÍ hace `.eq("doctor_id", me.id)`.
EVIDENCIA:
  // route.ts
  if (action === "refundAppointmentMercadoPago" && appointmentId) {
    if (user.role === "patient") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    const result = await refundAppointmentViaMercadoPago(appointmentId); // <- sin scoping por médico
    ...
  }
  // appointment-refund.ts
  const { data: apt } = await supabase.from("appointments").select("*").eq("id", appointmentId).maybeSingle();
  ...
  const accessToken = await getDoctorMercadoPagoAccessToken(apt.doctor_id);
  const refund = await refundPayment(accessToken, apt.mercadopago_payment_id);
ESCENARIO PARA REPRODUCIR: Médico A autenticado envía POST a /api/clinic/appointments con { action: "refundAppointmentMercadoPago", appointmentId: <id de un turno del Médico B, en estado cancelled + payment_status confirmed> }. Se ejecuta el reembolso real contra la cuenta MP del Médico B y el turno queda marcado "refunded".
IMPACTO: Un médico puede provocar movimientos de dinero (reembolso real al paciente) y corromper el estado de pago de turnos de OTROS médicos/organizaciones — acción financiera cross-tenant sin autorización. `markAppointmentRefundedManually` permite además marcar como "refunded" cualquier turno de transferencia ajeno (corrupción de estado, sin dinero).
PROBABILIDAD: baja (requiere que el turno objetivo ya esté cancelled+confirmed y conocer su UUID, no enumerable) — pero la entropía del id NO es un control de acceso; el control de autorización está roto.
RECOMENDACION: Antes de reembolsar, resolver el profesional autenticado (`resolveProfessional`) y exigir que `apt.doctor_id === me.id` (o validación por org con rol admin), igual que ya hace `doctorDeleteAppointment`. Aplicar el mismo scoping en ambas acciones de reembolso.
```

```
ID: PAY-002
SEVERIDAD: P1
AREA: Webhooks / Verificación de firma
ARCHIVO: src/app/api/clinic/mercadopago/webhook/route.ts
LINEA: 52-64
DESCRIPCION: La verificación de la firma `x-signature` es condicional a que exista `MERCADOPAGO_WEBHOOK_SECRET`. Si la env var no está seteada (o está vacía), el bloque `if (webhookSecret)` se saltea por completo y el webhook procesa la notificación sin ninguna verificación (fail-open). El webhook es a la vez el de pagos de turnos/recetas y el de suscripciones (`api/webhooks/mercadopago` reexporta esta ruta).
EVIDENCIA:
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    const valid = verifyMercadoPagoWebhookSignature({ ... });
    if (!valid) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }
  // si no hay secret -> se procesa sin verificar
ESCENARIO PARA REPRODUCIR: Deploy a producción sin `MERCADOPAGO_WEBHOOK_SECRET` (env manual en Vercel). Un tercero puede POSTear a /api/webhooks/mercadopago con `data.id` arbitrario y forzar el procesamiento (replay de notificaciones, sondeo de ids de pago/preapproval).
IMPACTO: Sin firma, se pierde la única barrera de autenticidad del webhook. El daño real está acotado porque el handler re-consulta el pago contra el token del médico y solo confirma pagos "approved" reales (no se puede fabricar un pago), pero habilita replays, disparo prematuro de transiciones de estado y sondeo. Defensa en profundidad rota.
PROBABILIDAD: media (depende de una env var fácil de olvidar; el resto del setup de MP es manual en Vercel).
RECOMENDACION: Hacer la firma OBLIGATORIA en producción: si `NODE_ENV === "production"` y falta el secret, rechazar (500/401) en vez de procesar. No permitir el camino fail-open fuera de desarrollo/local.
```

```
ID: PAY-003
SEVERIDAD: P2
AREA: Idempotencia / Confirmación de pago
ARCHIVO: src/lib/clinic/appointment-payment.ts (y src/lib/clinic/prescription-payment.ts)
LINEA: appointment-payment.ts 120-167 y 205-224 ; prescription-payment.ts 31-51
DESCRIPCION: La confirmación hace read-then-write sin guarda atómica: primero lee `payment_status`, decide `wasPending`, y luego hace UPDATE sin condicionar por estado (`.eq("id", ...)` únicamente, sin `.eq("payment_status", "pending")`). Dos ejecuciones concurrentes (el webhook de MP y el fallback POST /api/clinic/mercadopago/sync, que está DISEÑADO para dispararse al volver del checkout) pueden ambas leer "pending", pasar la guarda, y ambas enviar mail de confirmación al paciente y `notifyDoctorMercadoPagoPayment`. La guarda de `payment_receipt_audit` usa la lectura obsoleta (`!apt.payment_receipt_audit`), por lo que ambas la escriben.
EVIDENCIA:
  if (apt.payment_status === "confirmed" || apt.payment_status === "waived") return apt;
  const wasPending = apt.payment_status === "pending";
  const { data: updated } = await supabase.from("appointments")
    .update({ payment_status: "confirmed", ... })
    .eq("id", appointmentId)   // <- no condiciona por estado previo
    .select().single();
  if (!wasPending) return updated;
  ... sendAppointmentConfirmationEmail(...); await notifyDoctorMercadoPagoPayment(...)
ESCENARIO PARA REPRODUCIR: El paciente vuelve del checkout: la UI llama a /sync (que corre processMercadoPagoPaymentId) al mismo tiempo que MP entrega el webhook. Ambos confirman el mismo turno pending en paralelo -> doble notificación al médico + doble mail al paciente.
IMPACTO: Notificaciones in-app y mails de confirmación duplicados (ruido, no dinero duplicado). Deteriora la confianza en la bandeja de Cobros/notificaciones.
PROBABILIDAD: media (webhook + sync corren casi simultáneos por diseño).
RECOMENDACION: Hacer la transición idempotente a nivel DB: condicionar el UPDATE con `.eq("payment_status", "pending")` y usar el número de filas afectadas para decidir si se envían notificaciones/mails (solo la ejecución que ganó la carrera notifica). Alternativamente, un UPDATE ... RETURNING con guarda de estado.
```

```
ID: PAY-004
SEVERIDAD: P2
AREA: Validación de transferencia / Auto-aprobación por el propio pagador
ARCHIVO: src/app/api/clinic/payment-receipt/validate/route.ts (+ src/lib/ai/payment-receipt.ts, src/lib/clinic/payment-validation.ts)
LINEA: validate/route.ts 26-29 y 116-117 ; payment-receipt.ts 372-478 ; payment-validation.ts 6-15
DESCRIPCION: El paciente sube su propio "comprobante de transferencia" y el sistema lo aprueba automáticamente (confirmAppointmentPaymentAndNotify) cuando la IA (Gemini) considera `valid`. La credencial es solo el `access_token` del turno (magic-link, sin login). La validez se decide a partir de una IMAGEN que provee el propio pagador; una imagen falsificada con el nombre/CBU/monto correctos puede pasar las comprobaciones (holderName/amount/cbu), y no hay ninguna verificación bancaria real. Además, si Gemini no está configurado y el modo NO es estricto (`CLINIC_RELAX_PAYMENT_VALIDATION=true`, o local), `validatePaymentReceiptHeuristic` devuelve `valid: true, confidence: 80` para CUALQUIER archivo (payment-receipt.ts 412-454).
EVIDENCIA:
  // validate/route.ts — credencial = access_token del turno; auto-confirma si result.valid
  const apt = await resolveAppointmentByAccessToken(aptAccessToken);
  ...
  if (result.valid) { await confirmAppointmentPaymentAndNotify(row.id as string); }
  // payment-receipt.ts (rama no-estricta) — aprueba cualquier archivo
  if (!strictMode) { return { valid: true, confidence: 80, ... reasons: ["Comprobante registrado (modo demo / local)"] }; }
  // payment-validation.ts — estricto por defecto en prod, salvo override
  if (process.env.CLINIC_RELAX_PAYMENT_VALIDATION === "true") return false;
ESCENARIO PARA REPRODUCIR: Paciente con un turno pendiente por transferencia sube una imagen editada que muestra el nombre del titular, CBU y monto esperados. La IA extrae esos campos, `evaluatePaymentReceiptChecks` da valid=true y el turno se confirma sin que el médico haya recibido dinero. Variante: si algún deploy setea `CLINIC_RELAX_PAYMENT_VALIDATION=true`, cualquier archivo confirma el turno.
IMPACTO: Confirmación de turnos sin pago real (fraude del propio paciente). En modo relajado, auto-confirmación total de cualquier archivo. El médico ve el turno como pagado.
PROBABILIDAD: media (requiere falsificar un comprobante creíble; el modo estricto por defecto en prod mitiga parcialmente, pero no verifica contra el banco).
RECOMENDACION: Tratar la validación por IA como "pendiente de revisión" en montos relevantes en vez de confirmación automática, o exigir confirmación manual del médico para transferencias. Blindar `CLINIC_RELAX_PAYMENT_VALIDATION` para que sea ignorada en producción. No confiar en `valid` de una imagen provista por el pagador como única fuente de verdad.
```

```
ID: PAY-005
SEVERIDAD: P3
AREA: Doble cobro / Reconciliación
ARCHIVO: src/lib/mercadopago/checkout.ts (+ src/lib/clinic/appointment-payment.ts)
LINEA: checkout.ts 132-156 ; appointment-payment.ts 120-123
DESCRIPCION: Cada GET de checkout crea una preferencia NUEVA y sobrescribe `mercadopago_preference_id`, sin invalidar la anterior. Si el paciente paga dos links de preferencia del mismo turno, el primer webhook confirma el turno; el segundo pago real es ignorado por la guarda `payment_status === "confirmed"` (retorna temprano) — no se registra ni se reembolsa.
EVIDENCIA:
  // appointment-payment.ts
  if (apt.payment_status === "confirmed" || apt.payment_status === "waived") return apt; // segundo pago real: se descarta sin reembolso
ESCENARIO PARA REPRODUCIR: Paciente abre el checkout dos veces (o reintenta) y completa dos pagos aprobados. El sistema confirma una vez; el segundo importe queda cobrado en MP sin registro ni devolución.
IMPACTO: Sobrecobro real al paciente sin trazabilidad en el sistema (ni reembolso automático ni asiento en Cobros).
PROBABILIDAD: baja (requiere que el usuario pague dos veces).
RECOMENDACION: Al recibir un pago approved para un turno ya confirmado con un `mercadopago_payment_id` distinto, registrar el pago extra y/o disparar un reembolso automático; alternativamente reutilizar la preferencia existente en vez de crear una nueva en cada GET.
```

```
ID: PAY-006
SEVERIDAD: P3
AREA: OAuth / Exposición de configuración
ARCHIVO: src/app/api/clinic/mercadopago/oauth/diagnose/route.ts
LINEA: 7-60
DESCRIPCION: El endpoint GET de diagnóstico no exige autenticación. Devuelve `clientId` y `redirectUri` de la app MP y, en cada llamada, ejecuta un `client_credentials` contra la API de MP con las credenciales del servidor.
EVIDENCIA:
  export async function GET() {
    const config = getMpOAuthConfig();
    ...
    return NextResponse.json({ ok: true, redirectUri: config.redirectUri, clientId: config.clientId, ... });
  }
ESCENARIO PARA REPRODUCIR: Cualquiera hace GET a /api/clinic/mercadopago/oauth/diagnose y obtiene clientId/redirectUri y puede gatillar repetidamente el token-request a MP.
IMPACTO: Divulgación de metadatos de configuración (el client secret NO se expone) y superficie para abuso/ruido contra MP. Bajo impacto directo.
PROBABILIDAD: baja.
RECOMENDACION: Exigir sesión de médico (requireAuth) para el endpoint de diagnóstico, o restringirlo a un rol admin.
```

---

## Aspectos verificados como CORRECTOS (no son hallazgos)

- **Montos no provienen del cliente:** `createCheckoutPreference` fija `unit_price` server-side desde `office_settings.payment.consultationFee` (checkout.ts 120-141), `prescriptions.price_amount` (prescription-checkout.ts 51-53) y `nodo_core.planes` (nodo-subscription.ts, patient-subscription/checkout). No hay ruta donde el importe se lea del body del cliente.
- **`external_reference` no manipulable:** lo fija el servidor al crear la preferencia (`apt.id` / `receta:<id>`) y MP lo devuelve firmado en el pago. El webhook confirma el turno identificado por el `external_reference` del pago real, no por un id del cliente.
- **Confirmación contra el pago real:** `handle-payment-webhook` re-consulta `getPayment` con el token OAuth de cada médico y solo confirma si `status === "approved"` y el turno/​receta pertenece a ese médico (`.eq("doctor_id", ...)`). Aislamiento por profesional correcto.
- **Aislamiento de tokens OAuth:** `payment_credentials` se lee/escribe siempre con service-role, keyed por `professional_id`, con RLS que bloquea el acceso autenticado (db/payments.ts 24-70). Sin fallback al token de plataforma de Nodo para cobrar a pacientes.
- **Idempotencia de reembolso en MP:** `refundPayment` envía `X-Idempotency-Key: paymentId` (client.ts 118-130); a nivel app, tras un reembolso exitoso el estado pasa a "refunded" y la guarda `payment_status !== "confirmed"` bloquea un segundo reembolso (appointment-refund.ts 23-25). Sin doble reembolso.
- **Firma HMAC bien implementada:** `verifyMercadoPagoWebhookSignature` usa el manifest correcto (`id:<data.id>;request-id:<x-request-id>;ts:<ts>;`), HMAC-SHA256 y `timingSafeEqual` (webhook-verify.ts). El único problema es su enforcement condicional (PAY-002).
- **Estado OAuth (CSRF):** el callback re-valida que el profesional autenticado sea el dueño del `state` pendiente (`professional.id === match.professional_id`) y expira el state a 15 min; PKCE S256 por defecto.
- **Suscripciones (Nodo→médico y pacientes):** usan siempre el token propio de Nodo (`MERCADOPAGO_ACCESS_TOKEN`), nunca el OAuth del médico; precio leído en vivo de `nodo_core.planes`; conversión USD→ARS vía FX. Reembolso de turnos usa el token del médico. Separación correcta.
```
