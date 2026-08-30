# Nodo Clínica — Mapa de Arquitectura

> Documento de referencia para el equipo de auditoría de producción. Describe cómo fluyen los datos
> reales en el código, no solo la estructura de carpetas. Toda ruta de archivo es relativa a
> `/Users/ramirotule/Documents/1.Proyectos/nodocore/nodo-clinica` salvo que se indique lo contrario.
>
> **Nota de corrección sobre los datos de partida del proyecto**: los "PROJECT FACTS" del brief
> indican que las tablas clínicas viven en el schema `public`. Verificado contra el código
> (`clinicaSupabaseClientOptions = { db: { schema: "nodo_clinica" } }` en
> `src/lib/supabase/clinica-auth.ts`, usado por todos los clientes Supabase de esta app) y contra
> `mcp__supabase__list_tables`, esto es **incorrecto**: las tablas operativas reales
> (`patients`, `professionals`, `appointments`, `clinical_records`, `prescriptions`,
> `study_orders`, `soap_summaries`, `patient_documents`, `office_settings`, `institutions`, etc.)
> viven en el schema **`nodo_clinica`**, con filas reales (8 patients, 11 professionals, 13
> appointments, etc.). El schema `public` sí existe en el mismo proyecto Supabase pero contiene
> tablas de **otros productos Nodo** (`rjtech_*`, `clientes`, `vehicles`, `contracts`,
> `cash_movements`...) más un puñado de tablas `public.patients` / `public.appointments` /
> `public.clinical_records` etc. que están **vacías (0 filas) y no son las que usa el código de
> Nodo Clínica** (no hay ninguna referencia en `src/` a `.schema("public")` para estas entidades).
> Todo hallazgo de otros agentes sobre RLS/columnas debe verificarse contra `nodo_clinica.*`, no
> `public.*`. También existe `nodo_clinica.medical_records` (0 filas) que parece un remanente de un
> nombre anterior de `clinical_records` (5 filas) — no se encontraron referencias activas en código.

## 1. Stack tecnológico (verificado en `package.json` + código)

| Categoría | Tecnología | Evidencia |
|---|---|---|
| Framework | Next.js 16.2.9 (App Router), React 19.2.4 | `package.json` |
| Lenguaje | TypeScript 5, Zod 4 para validación | `package.json` |
| Estado servidor | TanStack Query 5.80 | `package.json` |
| Estado cliente | Zustand 5 | `package.json` |
| Backend as a Service | Supabase (`@supabase/ssr` 0.12, `@supabase/supabase-js` 2.108) — Auth, Postgres, Storage, Realtime | `src/lib/supabase/*` |
| JWT propio | `jose` 6.2 — firma/verifica cookies de sesión propias y JWT de JaaS | `src/lib/clinic/session.ts`, `src/lib/jitsi/generate-jaas-jwt.ts` |
| PDF | `jspdf` 4.2 — recetas, historias clínicas, informes | `src/lib/pdf/generator.ts`, `src/lib/clinic/clinical-record-document.ts` |
| Parsing PDF | `pdf-parse` 2.4 — lectura de comprobantes de pago subidos | uso en validación de comprobantes de transferencia |
| Email | `nodemailer` 8 (SMTP real, **no** el servicio "Resend" pese al nombre del archivo `src/lib/email/resend.ts`) | `src/lib/mail.ts` (`nodemailer.createTransport`) |
| IA generativa | `@google/generative-ai` 0.24 (Gemini) — SOAP e informes clínicos | `src/lib/ai/gemini.ts` |
| Videollamada | Jitsi as a Service (JaaS / 8x8.vc), JWT RS256 propio | `src/lib/jitsi/*` |
| Pagos | MercadoPago (OAuth + Checkout Pro + Preapproval/suscripciones), integración HTTP directa (sin SDK oficial, `fetch` a la API REST) | `src/lib/mercadopago/*` |
| OCR local | `tesseract.js` 7 — cliente, probablemente para extraer texto de comprobantes | `package.json` |
| Blob storage temporal | `@vercel/blob` 2.4 — **solo usado en modo demo local** (`src/lib/clinic/local-db.ts`), no en el flujo de producción con Supabase | ver §7 |
| UI | Tailwind CSS v4, Radix UI, `@base-ui/react`, `shadcn`, `lucide-react` | `package.json` |
| Monorepo interno | `@nodocore/nodo-modules`, `@nodocore/shared-components` (workspace packages compartidos con otros productos Nodo) | `package.json` |

Next.js corre con `--webpack` explícito en `dev`/`build` (no Turbopack) — ver `scripts` en `package.json`.

## 2. Árbol de rutas

### 2.1 Páginas públicas / auth
```
/                          (landing / redirect)
/login, /login/medico, /login/paciente
/registro, /registro/medico, /registro/paciente
/onboarding/medico, /onboarding/paciente
/recuperar-contrasena, /actualizar-contrasena
/auth/callback, /auth/login          → callback de Supabase Auth (OAuth/magic link)
/pedir-turno                          → flujo público de reserva sin login previo
```

### 2.2 Portal médico — `src/app/medico/*` (layout único `medico/layout.tsx`)
```
/medico/dashboard              → cola de turnos, videollamada, notificaciones realtime
/medico/pacientes, /medico/pacientes/[id]
/medico/recetas                → listado/emisión de recetas (con recetas-client.tsx)
/medico/asignar-turnos
/medico/turnos-programados
/medico/interconsultas          → chat entre profesionales (interconsult)
/medico/cobros                  → ledger de pagos/cobros del médico
/medico/consultorio              → configuración de agenda/horarios/fee
/medico/configuracion
/medico/suscripcion-plataforma   → estado y pago de la suscripción del médico a Nodo
```

### 2.3 Portal paciente — `src/app/paciente/*`
```
/paciente/(portal)/inicio
/paciente/(portal)/turnos
/paciente/(portal)/historial
/paciente/(portal)/salud
/paciente/(portal)/estudios
/paciente/(portal)/recetas
/paciente/(portal)/perfil
/paciente/receta/[accessToken]      → vista de receta SIN login, autenticada por token en la URL
/paciente/sala/[token]               → sala de espera/videollamada SIN login, autenticada por access_token del turno
```
El grupo `(portal)` comparte `layout.tsx` (requiere sesión de paciente); las rutas `receta/[accessToken]`
y `sala/[token]` están **fuera** de ese grupo a propósito: son de acceso directo por link (email/WhatsApp),
sin cuenta — la autorización se hace validando el token contra la fila en DB, no contra una sesión.

### 2.4 API — `src/app/api/*` (~88 route handlers)

Grupos principales bajo `src/app/api/clinic/`:
- `account/*` — login, registro, onboarding, recuperación de contraseña, verificación de email/portal, `platform-sync` (SSO entre productos Nodo)
- `auth/*` — login/registro/sesión alternativo (legado, convive con `account/*` y con Supabase Auth — ver §3)
- `appointments/*`, `schedule`, `in-person-availability`, `institutions/*` — turnos y agenda (virtual y presencial)
- `prescriptions/*`, `patient-prescriptions/*` — recetas (emisión, PDF, envío, checkout de pago si aplica)
- `clinical-records/*`, `clinical-report/generate`, `notes`, `patient-history` — historia clínica y notas SOAP/IA
- `study-orders` — órdenes de estudio
- `documents` — subida/borrado de documentos del paciente (Supabase Storage)
- `mercadopago/*` — OAuth de cada médico, webhook, sync, test de conexión/QR (detalle en §5)
- `patient-subscription/checkout`, `subscription/checkout` — checkout de suscripciones (paciente / médico)
- `interconsult/*` — mensajería entre médicos + presencia + contadores de no leídos
- `medico/pacientes/*` — ficha de paciente vista por el médico
- `payment-receipt/*` — preview/validación de comprobantes de transferencia (con IA, `src/lib/ai/payment-receipt.ts`)
- `medical-directory`, `pharmacy-on-call`, `obras-sociales`, `specialties`, `medications/search` — catálogos
- `notifications`, `reminders`, `tasks`, `jitsi-token`, `health`

Fuera de `clinic/`:
- `api/appointments` — **ruta de reserva alternativa/legada**: crea paciente + turno directo contra
  `nodo_clinica.appointments` sin pasar por `requireAuth`/`resolve-clinic-role`, usando el
  `access_token` autogenerado como único control de acceso (ver `src/app/api/appointments/route.ts`).
  Convive con `api/clinic/appointments`, que sí pasa por el guard de auth. Confirmar con el equipo si
  sigue en uso o es dead code — impacta el análisis de superficie de auth de otros agentes.
- `api/prescriptions/send`, `api/study-orders`, `api/soap/generate` — variantes fuera de `clinic/`.
- `api/webhooks/mercadopago` — alias público, re-exporta `api/clinic/mercadopago/webhook`.
- `api/cron/*` — `appointment-reminders`, `medical-directory`, `pharmacy-on-call` (jobs programados, probablemente Vercel Cron).

## 3. Autenticación y autorización — el flujo real

Nodo Clínica sostiene **dos mecanismos de sesión en paralelo** y los reconcilia en cada request:

1. **Sesión Supabase Auth** (cookies `sb-*`, JWT de Supabase) — el camino "normal" en producción.
2. **`ClinicSession`**: JWT propio firmado con `jose`/HS256, cookie httpOnly `clinica_session`
   (`src/lib/clinic/session.ts`), usado por logins vía `platform-sync` (SSO entre productos Nodo) y por
   el modo demo local (`NEXT_PUBLIC_CLINIC_MODE=local`, sin Supabase).

### 3.1 Cadena real de capas

```
middleware.ts
  └─ updateSession() (src/lib/supabase/middleware.ts)
       └─ createServerClient(...).auth.getUser()   // refresca/valida cookies sb-* en TODA request
                                                    // (matcher excluye _next/static, imágenes, favicon)
```
`middleware.ts` **no** decide roles ni bloquea rutas — solo mantiene viva/renovada la sesión de
Supabase reescribiendo cookies en la response. El control de acceso real ocurre **dentro de cada
route handler**, llamando a `requireAuth()`.

```
requireAuth(request)  (src/lib/supabase/auth-guard.ts)
  1. resolveSupabaseAuthUser(request)        (src/lib/supabase/resolve-auth-user.ts)
       — intenta cookie de Supabase (supabase.auth.getUser())
       — si falla, intenta header Authorization: Bearer <token> vía service client
  2. si hay user Supabase:
       a. lookupClinicMembershipByAuthUserId(svc, user.id, user.email)   (resolve-clinic-role.ts)
          — busca en nodo_clinica.professionals y nodo_clinica.patients por user_id/profile_id
          — fallback por email si no hay vínculo por id (auto-repara escribiendo el id)
       b. resolveRoleForContext(membership) → rol "medico" | "paciente" (prioriza medico si tiene ambos)
       c. getSession() en paralelo (ClinicSession) — si dice "patient" y la membership lo permite,
          fuerza el rol efectivo a "patient" (deja elegir portal a cuentas duales)
       d. GATE 1 — doctor sin professionals.id → 401
       e. GATE 2 — doctor con professionals.id pero `enabled_at` NULL (no aprobado por admin)
          → 403 PROFESSIONAL_PENDING_APPROVAL_CODE (pendingApprovalResponse())
          Este gate es independiente de la suscripción/trial (isSubscriptionActive() en trial.ts)
       f. paciente sin patients.id → 401
       g. arma AuthContext { user, _professionalId, supabase } — org_id se fija por código
          (getClinicOrgId(), NUNCA se lee de user.app_metadata porque ese claim es compartido
          entre todos los productos Nodo del usuario)
  3. si NO hay user Supabase → fallback a ClinicSession (cookie clinica_session):
       — mismo GATE de enabled_at para doctor (salvo isLocalMode())
  4. si tampoco hay ClinicSession → 401
  5. Modo local sin Supabase configurado (isLocalMode() true por falta de env) → solo ClinicSession,
     supabase client es null (los handlers usan local-db.ts en su lugar)
```

`resolveProfessional(auth)` (mismo archivo) resuelve la fila `professionals` real a partir del
`AuthContext`: usa `_professionalId` directo si viene de `ClinicSession`, o busca por `user_id` y
hace fallback por `email` (con auto-heal del `user_id`) si viene de Supabase Auth.

### 3.2 Dónde se aplican planes/roles

- **Rol** (`medico`/`paciente`): resuelto en `resolve-clinic-role.ts` a partir de la existencia de fila
  en `professionals`/`patients`, no de un claim de JWT.
- **Aprobación de profesional** (`professionals.enabled_at`): gate binario, ver arriba — bloquea el
  panel operativo aunque el onboarding esté "completo".
- **Suscripción/trial** (`professionals.subscription_status`, `trial_ends_at`): `src/lib/clinic/trial.ts`
  → `isSubscriptionActive()`. Nodo Clínica **no tiene diferencias de features entre Free y Pro**: la
  única diferencia es la ventana de acceso (`TRIAL_DAYS = 10`). Estados: `active`, `courtesy` (cortesía
  manual desde NodoCore), `demo` (activo solo si no venció el trial), `pending_payment`/`expired`
  (sin acceso). Este chequeo vive en el guard de onboarding del layout del médico
  (`medico-admin-layout`, según memoria del equipo) y no en `requireAuth` — son gates independientes.
- **Pausado** (`paused_at` en `professionals`/`patients`): `isRolePaused()`, gate independiente del
  vínculo `user_id`/`profile_id` porque ese vínculo se re-establece en cada login.

### 3.3 Autenticación por token (sin sesión)

Dos flujos deliberadamente bypasean `requireAuth` porque el "secreto" es el propio token en la URL:
- `paciente/receta/[accessToken]` + `api/clinic/prescriptions/[accessToken]/*` — recetas.
- `paciente/sala/[token]` + `access_token` de `appointments` — sala de espera/videollamada.

`src/lib/clinic/appointment-token-auth.ts` y `prescription-token-auth.ts` validan estos tokens
(incluye expiración vía `token_expires_at`).

## 4. Modelo de datos (schema `nodo_clinica`, verificado vía Supabase MCP)

Tablas con datos reales (proyecto pre-producción, `iprrlgmhpsxzyrejabtu`):

| Tabla | Filas | Rol |
|---|---|---|
| `professionals` | 11 | médicos — identidad, matrícula, `enabled_at`, `subscription_status`, `trial_ends_at`, `paused_at` |
| `patients` | 8 | pacientes — `profile_id` (link a auth user), `paused_at` |
| `appointments` | 13 | turnos — `access_token`, `jitsi_room_id`, `payment_status`, `mercadopago_payment_id`, `org_id` |
| `office_settings` | 9 | config por médico: `payment` (fee, moneda), `reminder_settings` |
| `clinical_records` | 5 | historia clínica |
| `clinical_notes` | 4 | notas de consulta |
| `soap_summaries` | 4 | resúmenes SOAP generados por Gemini |
| `prescriptions` | 6 | recetas — soporta flujo standalone (`receta:` prefix en pagos) y ligadas a turno |
| `study_orders` | 2 | órdenes de estudio |
| `patient_documents` | 1 | documentos subidos por paciente (bucket `patient-documents`) |
| `payment_credentials` | 6 | tokens OAuth de MercadoPago por médico |
| `institutions` | 4 | instituciones para turnos presenciales |
| `in_person_availability` | 1 | disponibilidad presencial |
| `doctor_notifications` | 12 | notificaciones del médico (incluye pagos MP) |
| `interconsult_messages` | 11 | chat entre médicos |
| `doctor_presence` | 9 | presencia online para interconsulta |
| `chat_read_cursors` | 7 | cursores de lectura del chat |
| `patient_health_profiles` | 6 | perfil de salud del paciente |
| `medical_directory` | 27 | directorio médico público (para derivaciones/interconsulta) |
| `obras_sociales` | 23 | catálogo de obras sociales |
| `pending_clinic_registrations` | 2 | registros pendientes de onboarding |
| `account_activation_tokens` | 19 | tokens de activación de cuenta |
| `pharmacy_on_call_schedules` | 2 | guardias de farmacia |
| `transcriptions`, `doctor_tasks`, `health_insurances`, `medical_records` | 0 | sin uso / vacías |

Todas con `rls_enabled = true` (confirmado por `list_tables`). Este documento no verifica el
contenido de las policies — ver hallazgos de Seguridad/RLS de otros agentes.

`medical_specialties` vive en `public` (31 filas) — catálogo compartido entre productos Nodo, no
específico de la clínica.

## 5. Flujo de pagos — MercadoPago

### 5.1 Modelo de conexión: OAuth por médico (no un token global de la plataforma)

Cada médico conecta **su propia cuenta** de MercadoPago (`payment_credentials`, 6 filas):
```
Médico → GET /api/clinic/mercadopago/oauth/connect
       → buildAuthorizationUrl() con PKCE (S256) → redirect a auth.mercadopago.com
       → MP redirige a MERCADOPAGO_OAUTH_REDIRECT_URI (default: /api/clinic/mercadopago/oauth/callback)
       → exchangeAuthorizationCode() → guarda access_token/refresh_token/expires_in en payment_credentials
```
`getDoctorMercadoPagoAccessToken()` (`src/lib/mercadopago/tokens.ts`) refresca el token si está por
vencer (`isTokenExpired`, skew de 5 min) antes de cada uso — nunca se expone al cliente.

### 5.2 Checkout (turno o receta standalone)

`src/lib/mercadopago/checkout.ts` / `prescription-checkout.ts` arman una preferencia de Checkout Pro
usando el token del médico dueño del turno/receta, con `external_reference`:
- Turno: `external_reference = appointmentId`
- Receta standalone: `external_reference = "receta:" + prescriptionId` (prefijo usado para
  desambiguar en el webhook — ver 5.3, comentario "Fase 4 de Recetas" en el código).

### 5.3 Webhook (IPN) — `POST /api/clinic/mercadopago/webhook` (alias público `/api/webhooks/mercadopago`)

```
MP → POST webhook { type, data.id }
  1. Extrae dataId (query o body)
  2. Si MERCADOPAGO_WEBHOOK_SECRET está seteado → verifyMercadoPagoWebhookSignature()
       HMAC-SHA256 sobre "id:{dataId};request-id:{xRequestId};ts:{ts};", comparación timing-safe
       (si el secret NO está seteado, el webhook NO valida firma — cualquiera puede pegarle)
  3. Si type es "subscription_preapproval"/"preapproval" → processMercadoPagoPreapprovalId()
     Si no → processMercadoPagoPaymentId():
       a. Trae TODOS los `office_settings.professional_id` (todos los médicos con settings)
       b. Para cada uno: obtiene su token OAuth, llama getPayment(token, paymentId) a la API de MP
          hasta encontrar el médico dueño de ese pago (búsqueda por fuerza bruta, O(n) llamadas a MP
          por webhook — funcional pero no escala con muchos médicos)
       c. Si el pago no está "approved" → responde ok, skip
       d. Si external_reference empieza con "receta:" → confirmPrescriptionPaymentAndNotify()
          Si no → confirmAppointmentPaymentAndNotify() (valida que el appointment pertenezca a
          ESE médico antes de confirmar — evita que el pago de un médico confirme el turno de otro)
  4. confirmAppointmentPaymentAndNotify(): idempotente — si ya está "confirmed"/"waived" retorna sin
     reprocesar; solo dispara email + notificación al médico si `wasPending` era true
```

### 5.4 Suscripciones (Preapproval API — médico paga a Nodo)

Memoria del equipo confirma que la facturación recurrente de Nodo vía Preapproval API está
**decidida pero no implementada aún** (`nodo-clinica-mercadopago-subscription-billing.md`); el código
de `handle-subscription-webhook.ts` existe y procesa eventos `preapproval`, pero conviene verificar
con el equipo el estado real de ese flujo antes de asumirlo completo en producción.

## 6. Realtime (Supabase Realtime / `postgres_changes`)

Se usa **channel por sesión de UI**, sin un hub central — cada componente abre su propio canal:

| Componente | Canal | Evento | Tabla (schema `nodo_clinica`) |
|---|---|---|---|
| `src/components/dashboard/doctor-dashboard.tsx` | `"doctor-appointments"` | `*` | `appointments` |
| `src/components/dashboard/doctor-dashboard.tsx` | `` `doctor-documents-${doctorId}` `` | `INSERT` | `patient_documents` |
| `src/components/patient/waiting-room.tsx` | `` `waiting-${accessToken}` `` | `UPDATE` | `appointments` |
| `src/components/patient/waiting-room.tsx` | `` `clinical-records-${appointment.id}` `` | `INSERT` | `clinical_records` |

El canal `"doctor-appointments"` no está namespaced por `doctorId` (a diferencia de
`doctor-documents-${doctorId}`) — si dos médicos tienen el dashboard abierto reciben el mismo nombre
de canal lógico; Supabase Realtime igual filtra server-side por RLS/policy, así que esto es una nota
de diseño, no necesariamente un hallazgo de seguridad (no se verificó aquí la policy de `appointments`
para `SELECT` bajo Realtime).

## 7. Storage

- **Bucket único identificado**: `"patient-documents"` (constante `STORAGE_BUCKET` en
  `src/app/api/clinic/documents/route.ts`; mismo bucket referenciado directo en
  `src/lib/clinic/appointment-documents.ts`). Usado para documentos que el paciente sube
  (estudios, comprobantes, etc.), con borrado explícito (`storage.remove`) al eliminar el registro.
- **`@vercel/blob`** (`src/lib/clinic/local-db.ts`, `get`/`head`/`put` con `import()` dinámico): usado
  **solo en modo demo local** (`isLocalMode()`) como backend de persistencia de un JSON de base de
  datos falsa — no interviene en el flujo de producción con Supabase.

## 8. APIs externas

| Servicio | Uso | Archivo clave |
|---|---|---|
| Google Gemini | Genera SOAP (`generateSoapSummary`) e informes clínicos (`generateClinicalReport`) a partir de transcripción/dictado. Fallback a mock local si falta `GEMINI_API_KEY` o si la cuota está agotada (detecta 429/RESOURCE_EXHAUSTED) | `src/lib/ai/gemini.ts` |
| Jitsi as a Service (8x8.vc) | Videollamada médico-paciente sin límite de 5 min. JWT propio RS256 firmado con clave privada de `JAAS_PRIVATE_KEY`, `kid = "{appId}/{apiKeyId}"` | `src/lib/jitsi/generate-jaas-jwt.ts` |
| Email SMTP (nodemailer) | Confirmaciones de turno, recordatorios, notificaciones de pago, credenciales de onboarding | `src/lib/mail.ts`, `src/lib/email/resend.ts` (naming engañoso — no es el servicio Resend) |
| MercadoPago REST API | OAuth, Checkout Pro, consulta de pagos, Preapproval — llamado directo con `fetch`, sin SDK | `src/lib/mercadopago/*` |
| Gemini (payment-receipt) | `src/lib/ai/payment-receipt.ts` — valida/extrae datos de comprobantes de transferencia subidos manualmente (OCR asistido por IA, complementa `tesseract.js` client-side) | |

## 9. Generación de PDF

`src/lib/pdf/generator.ts` (jsPDF, client+server) genera:
- Recetas (`drawSignatureBlock` con imagen de firma opcional + nombre + matrícula, soporta membrete
  de institución para recetas standalone vs. membrete de consultorio para recetas de consulta).
- Historias clínicas / informes (`src/lib/clinic/clinical-record-document.ts`,
  `clinical-records-pdf-local.ts`).

Rutas que sirven PDF: `api/clinic/clinical-records/pdf`, `api/clinic/patient-prescriptions/[id]/pdf`,
`api/clinic/prescriptions/[accessToken]/pdf`.

## 10. Feature flags

No se encontró un sistema de feature flags (no hay `FEATURE_*`, `featureFlags`, LaunchDarkly, etc.).
El único interruptor de comportamiento global por env var es **`NEXT_PUBLIC_CLINIC_MODE=local`**
(`isLocalMode()` en `src/lib/clinic/config.ts`), que conmuta toda la app a un modo demo sin Supabase
(persistencia en JSON vía `local-db.ts` + `@vercel/blob`). También actúa como flag implícito la
ausencia de credenciales de un proveedor externo (`GEMINI_API_KEY`, `JAAS_*`,
`MERCADOPAGO_CLIENT_ID/SECRET`), cada una con su propio fallback/mensaje de "no configurado" en
lugar de un flag explícito.

## 11. `localStorage` / `sessionStorage` / cookies

| Storage | Clave / uso | Archivo |
|---|---|---|
| Cookie httpOnly | `clinica_session` — JWT `ClinicSession` (HS256, 7 días, `secure` en producción) | `src/lib/clinic/session.ts` |
| Cookies `sb-*` | Sesión de Supabase Auth (gestionadas por `@supabase/ssr`) | `src/lib/supabase/{server,middleware}.ts` |
| `sessionStorage` | Cache de sesión de cliente (`client-api.ts`), cache de token de auth (`AUTH_TOKEN_CACHE`), cache de pricing (`patient-plan-upsell-card.tsx`), cache de perfil (`patient-settings-dialog.tsx`) | `src/lib/clinic/client-api.ts` y componentes citados |
| `localStorage` | Preferencias de tema del consultorio (`MEDICO_THEME_STORAGE_KEY`) y ajustes de tema generales (`use-theme-settings.ts`, dos implementaciones distintas: `src/hooks/` y `src/shared/hooks/`) | ver archivos |

Ninguno de estos usos de `localStorage`/`sessionStorage` guarda tokens de Supabase directamente (esos
van en cookies gestionadas por `@supabase/ssr`); sí cachean datos de sesión propia y de perfil — no se
evaluó aquí si algún dato ahí cacheado es sensible más allá de lo esperado para UX (fuera del alcance
de este documento; ver hallazgos de Seguridad).

## 12. Flujos secuenciales

### 12.1 Paciente reserva y paga un turno virtual

```
Paciente (pedir-turno / portal)
  │
  ├─ 1. POST /api/clinic/appointments (o /api/appointments, ver nota en §2.4)
  │      → crea/reutiliza fila en `patients`
  │      → crea fila en `appointments` (status="scheduled", payment_status="pending",
  │        access_token generado, jitsi_room_id, token_expires_at)
  │      → sendAppointmentConfirmationEmail() (nodemailer) con link a /paciente/sala/[access_token]
  │
  ├─ 2. Paciente abre /paciente/sala/[token] → valida access_token (appointment-token-auth.ts)
  │      → si el turno requiere pago: botón "Pagar" → checkout.ts arma preferencia MP
  │        con el token OAuth DEL MÉDICO y external_reference = appointmentId
  │      → redirect a MercadoPago Checkout Pro
  │
  ├─ 3. Paciente paga en MercadoPago
  │      → MP → POST /api/webhooks/mercadopago (alias) → /api/clinic/mercadopago/webhook
  │        → verifica firma HMAC (si MERCADOPAGO_WEBHOOK_SECRET está seteado)
  │        → busca médico dueño del pago iterando `office_settings` + getPayment() por cada token
  │        → confirmAppointmentPaymentAndNotify(appointmentId, { mercadopagoPaymentId, amount, currency })
  │            - idempotente (chequea payment_status actual)
  │            - marca payment_status="confirmed", payment_confirmed_at
  │            - escribe payment_receipt_audit sintético (para que aparezca en "Cobros" del médico)
  │            - envía email de confirmación al paciente
  │            - notifyDoctorMercadoPagoPayment() → fila en doctor_notifications
  │
  └─ 4. waiting-room.tsx tiene un canal Realtime `waiting-${accessToken}` escuchando UPDATE en
         `appointments` → detecta payment_status="confirmed" sin hacer polling → habilita el botón
         de entrar a la videollamada
         │
         └─ GET /api/clinic/jitsi-token?room=...&accessToken=...
                → valida que el jitsi_room_id del turno coincida con `room`
                → generateJaasJwt() (RS256, exp 3h) → cliente entra a 8x8.vc con ese JWT
```

### 12.2 Médico emite una receta

```
Médico autenticado (requireAuth → doctor, enabled_at set, membership.professionalId)
  │
  ├─ 1. Arma receta (medicación + notas) en /medico/recetas o durante una consulta
  │      → POST /api/clinic/prescriptions
  │        → crea fila en `prescriptions` (doctor_id, patient_id, medications, access_token)
  │
  ├─ 2a. Receta ligada a un turno (sin pago adicional):
  │       → PDF generado on-demand vía GET /api/clinic/prescriptions/[accessToken]/pdf
  │         (drawSignatureBlock con firma/matrícula del médico, membrete de consultorio)
  │       → envío por email al paciente: POST /api/clinic/prescriptions/[accessToken]/send
  │
  └─ 2b. Receta standalone paga (Fase 4, "recetas fuera de consulta"):
          → checkout con external_reference = "receta:" + prescriptionId
            (prescription-checkout.ts, mismo token OAuth del médico que 12.1)
          → mismo webhook de 12.1 la reconoce por el prefijo "receta:" y llama
            confirmPrescriptionPaymentAndNotify() en vez de confirmAppointmentPaymentAndNotify()
          → paciente accede sin login vía /paciente/receta/[accessToken]
            (prescription-token-auth.ts valida el token, incluye expiración)
```

## 13. Notas para otros agentes de la auditoría

- **Verificar contra `nodo_clinica.*`, no `public.*`** — el brief original apuntaba al schema
  equivocado para las tablas operativas de esta app.
- **Dos rutas de creación de turnos** (`api/appointments` sin `requireAuth` vs.
  `api/clinic/appointments` con guard) — confirmar con el equipo cuál está realmente en uso antes de
  reportar un hallazgo de "falta de auth" sobre la primera; podría ser dead code.
- **Webhook de MercadoPago sin firma si falta `MERCADOPAGO_WEBHOOK_SECRET`** — el código solo valida
  HMAC si la env var está seteada; vale la pena que el agente de Seguridad confirme si esa env var
  está configurada en producción (Vercel) y, si no, evalúe el impacto de un webhook público sin
  verificación de origen que puede marcar turnos/recetas como pagados.
- **Búsqueda de pago por fuerza bruta en el webhook** (itera todos los `office_settings` llamando a la
  API de MP) — no es un bug funcional hoy (pocos médicos), pero es una nota de escalabilidad para el
  agente de Performance.
