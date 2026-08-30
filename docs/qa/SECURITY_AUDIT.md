# Auditoría de Seguridad — Nodo Clínica

**Rol:** Application Security Auditor
**Alcance:** app `nodo-clinica` (Next.js 16 / Supabase), foco en secretos, autenticación, autorización, escalación de privilegios, pagos (MercadoPago) y advisors de seguridad de Postgres.
**Modo:** solo lectura. No se modificó código, migraciones, base de datos ni configuración.
**Fecha:** 2026-08-29
**Proyecto Supabase:** `iprrlgmhpsxzyrejabtu`

---

## Resumen ejecutivo

La postura de seguridad de la app-layer es en general razonable: el uso de `service_role` está correctamente confinado al servidor (5 archivos, todos en `src/lib/**` y rutas API — ninguno en componentes cliente), la verificación de firma del webhook de MercadoPago está implementada con HMAC-SHA256 y `timingSafeEqual`, y los tokens de MercadoPago por profesional se aíslan del token de plataforma de Nodo. Sin embargo, se encontraron **problemas graves**:

1. **RPC `admin_get_clinic_registrations` / `admin_delete_clinic_registration`** son `SECURITY DEFINER` **sin ninguna verificación interna de autorización**, y — según los advisors de Supabase — son ejecutables por el rol **`anon`** vía `/rest/v1/rpc/...`. La primera expone email + `onboarding_token` de todas las registraciones pendientes (habilita toma de cuenta); la segunda permite borrado destructivo. La migración hace `GRANT ... TO authenticated` pero **nunca hace `REVOKE ... FROM PUBLIC`**, dejando el `EXECUTE` por defecto para `anon`.
2. **Secreto de firma JWT de sesión hardcodeado como fallback** (`"clinica-dev-session-secret-change-in-prod"`) sin fail-fast. Si el deploy no define `CLINIC_SESSION_SECRET`/`CLINIC_ADMIN_SECRET`, cualquiera puede forjar la cookie `clinica_session` y, dado que `validateSessionUser` matchea pacientes por email, impersonar a cualquier paciente conociendo solo su email.
3. **PAT de Supabase en texto plano** en `.mcp.json` (gitignoreado — bien — pero es un token vivo con scope de administración de cuenta).

El resto son hallazgos P2/P3: firma de webhook condicional a env, endpoint `ensure-role` sin autenticación, tokens OAuth de MercadoPago en texto plano en DB, enumeración de usuarios sin rate-limiting, política de contraseñas débil, y una nube de advisors de Postgres (`security_definer_view`, funciones SECURITY DEFINER ejecutables por anon/authenticated, `function_search_path_mutable`, `auth_leaked_password_protection`, MFA insuficiente).

**Conteo:** 1 P0, 3 P1, 6 P2, 3 P3.

---

## Metodología

- Escaneo de secretos con `rg` sobre `nodo-clinica/` y `.mcp.json` raíz.
- Verificación uno-a-uno de los 5 archivos que referencian `SERVICE_ROLE`.
- Auditoría de `NEXT_PUBLIC_*` para fugas al bundle del navegador.
- Lectura de `middleware.ts`, `src/lib/supabase/*`, `session.ts` (jose/JWT), y endpoints sensibles: `ensure-role`, `forgot-password`, `set-password`, `platform-sync`, `login`.
- Lectura del webhook de MercadoPago y su verificador de firma.
- Lectura e interpretación de los 72 advisors de seguridad de Supabase (todos categoría SECURITY).

---

## Hallazgos

```
ID: SEC-001
SEVERIDAD: P0
AREA: Autorización / Exposición de datos (RPC público)
ARCHIVO: supabase/migrations/20260713_patients_profile_columns.sql
LINEA: 41-68
DESCRIPCION: La función public.admin_get_clinic_registrations() es SECURITY DEFINER, no tiene NINGUNA verificación interna de autorización, y devuelve email + role + onboarding_token + expires_at de TODAS las registraciones pendientes. La migración hace GRANT EXECUTE TO authenticated pero NO hace REVOKE FROM PUBLIC, por lo que el rol anon conserva el EXECUTE por defecto. Los advisors de Supabase la listan explícitamente como ejecutable por anon vía /rest/v1/rpc/admin_get_clinic_registrations.
EVIDENCIA:
  CREATE OR REPLACE FUNCTION public.admin_get_clinic_registrations()
  RETURNS TABLE (id uuid, email text, role text, verified_at timestamptz,
                 onboarding_token uuid, expires_at timestamptz, created_at timestamptz)
  LANGUAGE sql SECURITY DEFINER SET search_path = nodo_clinica, public
  AS $$ SELECT ... onboarding_token, ... FROM nodo_clinica.pending_clinic_registrations ... $$;
  GRANT EXECUTE ON FUNCTION public.admin_get_clinic_registrations() TO authenticated;
  -- Advisor: "Function public.admin_get_clinic_registrations() can be executed by the `anon` role as a SECURITY DEFINER function via /rest/v1/rpc/admin_get_clinic_registrations"
ESCENARIO PARA REPRODUCIR: Sin sesión, POST https://<proyecto>.supabase.co/rest/v1/rpc/admin_get_clinic_registrations con apikey=anon_key. Devuelve todas las registraciones pendientes con su onboarding_token.
IMPACTO: Fuga de PII (emails) y — crítico — de onboarding_token de cuentas aún no activadas. Ese token se usa para el flujo de activación/onboarding; su exposición habilita toma de cuenta (account takeover) de médicos/pacientes en proceso de alta. Exposición sin autenticación.
PROBABILIDAD: alta
RECOMENDACION: REVOKE EXECUTE ... FROM PUBLIC, anon; y agregar verificación de autorización dentro de la función (o moverla fuera del esquema expuesto por PostgREST). No devolver onboarding_token en ningún listado. NO implementar aquí.
```

```
ID: SEC-002
SEVERIDAD: P1
AREA: Autorización / Integridad (RPC público destructivo)
ARCHIVO: supabase/migrations/20260713_patients_profile_columns.sql
LINEA: 72-81
DESCRIPCION: public.admin_delete_clinic_registration(p_id uuid) es SECURITY DEFINER, hace DELETE incondicional sobre pending_clinic_registrations sin chequear autorización, y — igual que SEC-001 — solo tiene GRANT TO authenticated sin REVOKE FROM PUBLIC. Advisor la lista como ejecutable por anon.
EVIDENCIA:
  CREATE OR REPLACE FUNCTION public.admin_delete_clinic_registration(p_id uuid)
  RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = nodo_clinica, public
  AS $$ DELETE FROM nodo_clinica.pending_clinic_registrations WHERE id = p_id; $$;
  GRANT EXECUTE ON FUNCTION public.admin_delete_clinic_registration(uuid) TO authenticated;
  -- Advisor: ejecutable por `anon` via /rest/v1/rpc/admin_delete_clinic_registration
IMPACTO: Cualquier usuario (incluido anon) puede borrar registraciones pendientes de alta → denegación de servicio del onboarding. Combinado con SEC-001 (que expone los IDs), el borrado es dirigible.
ESCENARIO PARA REPRODUCIR: Obtener ids con SEC-001, luego POST /rest/v1/rpc/admin_delete_clinic_registration con {p_id}. La fila desaparece.
PROBABILIDAD: media
RECOMENDACION: REVOKE FROM PUBLIC/anon y añadir chequeo de rol admin dentro de la función. NO implementar aquí.
```

```
ID: SEC-003
SEVERIDAD: P1
AREA: Autenticación / Gestión de secretos (JWT de sesión)
ARCHIVO: src/lib/clinic/session.ts
LINEA: 26-32, 42-64, 93-108
DESCRIPCION: El secreto de firma del JWT de sesión (cookie clinica_session, HS256) cae a un valor hardcodeado en el código si no están definidas CLINIC_SESSION_SECRET ni CLINIC_ADMIN_SECRET. No hay fail-fast: la app arranca y firma/valida sesiones con un secreto conocido y presente en el repo. Además, validateSessionUser resuelve al paciente por email (.or(profile_id.eq..., email.eq...)), de modo que una sesión forjada con un email arbitrario matchea a ese paciente.
EVIDENCIA:
  function sessionSecret(): Uint8Array {
    const raw = process.env.CLINIC_SESSION_SECRET || process.env.CLINIC_ADMIN_SECRET
      || "clinica-dev-session-secret-change-in-prod";
    return new TextEncoder().encode(raw);
  }
  // validateSessionUser (patient path):
  .or(`profile_id.eq.${session.userId},email.eq.${session.email.toLowerCase()}`)
ESCENARIO PARA REPRODUCIR: Si el deploy de producción omite ambas env vars, un atacante firma un JWT {userId, role:"patient", email:"<victima>", fullName:"x"} con el secreto por defecto, lo setea como cookie clinica_session y accede a los datos clínicos del paciente cuyo email conoce.
IMPACTO: Forja de sesión → impersonación de pacientes (acceso cross-user a datos clínicos) y de médicos si se conoce professionals.id/user_id. Efectivamente P0 si la env var falta en prod.
PROBABILIDAD: media (depende de config de deploy; sin guard que lo prevenga)
RECOMENDACION: Fail-fast en producción: lanzar error de arranque si el secreto no está definido y NODE_ENV=production. Eliminar el fallback hardcodeado. Considerar no matchear pacientes por email en validateSessionUser. NO implementar aquí.
```

```
ID: SEC-004
SEVERIDAD: P1
AREA: Gestión de secretos (token vivo en disco)
ARCHIVO: /Users/ramirotule/Documents/1.Proyectos/nodocore/.mcp.json
LINEA: 8-11
DESCRIPCION: El archivo .mcp.json contiene un Personal Access Token de Supabase (sbp_****REDACTED) en texto plano, pasado como argumento de línea de comandos al MCP server. Es un token vivo con alcance de administración de la cuenta Supabase. Está correctamente gitignoreado (git check-ignore .mcp.json => IS_IGNORED; entradas .mcp.json y .cursor/mcp.json en el .gitignore raíz), pero sigue en disco en claro.
EVIDENCIA:
  "args": ["-y","@supabase/mcp-server-supabase@latest","--access-token","sbp_****REDACTED"]
  $ git check-ignore .mcp.json  => .mcp.json (IS_IGNORED)
ESCENARIO PARA REPRODUCIR: Cualquier proceso, backup, sync de disco o acceso local que lea el archivo obtiene un PAT administrativo de Supabase.
IMPACTO: Un PAT de Supabase con este alcance permite listar/gestionar proyectos, aplicar migraciones y potencialmente leer datos vía API de management. Riesgo alto si el disco/backup se filtra o si se comparte la carpeta.
PROBABILIDAD: baja (mitigado por gitignore; el vector es exposición local/backup)
RECOMENDACION: Rotar el PAT (ya fue visto durante esta auditoría). Preferir pasar el token vía variable de entorno (env del MCP) en lugar de argv en claro. NO implementar aquí.
```

```
ID: SEC-005
SEVERIDAD: P2
AREA: Pagos / Integridad de webhook
ARCHIVO: src/app/api/clinic/mercadopago/webhook/route.ts
LINEA: 52-64
DESCRIPCION: La verificación de firma del webhook de MercadoPago solo se ejecuta si MERCADOPAGO_WEBHOOK_SECRET está definido. Si la env var falta, el bloque se saltea por completo y el webhook procesa cualquier payload sin autenticación. El verificador en sí (webhook-verify.ts) está bien hecho (HMAC-SHA256 + timingSafeEqual), pero es condicional.
EVIDENCIA:
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    const valid = verifyMercadoPagoWebhookSignature({...});
    if (!valid) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }
  // si !webhookSecret => se procesa dataId sin verificar firma
ESCENARIO PARA REPRODUCIR: Con la env var ausente, POST al endpoint con {type, data:{id}} arbitrario dispara processMercadoPagoPaymentId/Preapproval sin firma. La mitigación parcial es que el handler consulta la API de MP (requiere un payment id real), pero permite replay y sondeo.
IMPACTO: Spoofing/replay de notificaciones de pago si el secreto no está configurado; confirmación de turnos/suscripciones no autenticada.
PROBABILIDAD: media
RECOMENDACION: Exigir MERCADOPAGO_WEBHOOK_SECRET en producción (rechazar/loguear si falta) en vez de saltear la verificación. NO implementar aquí.
```

```
ID: SEC-006
SEVERIDAD: P2
AREA: Autenticación / Escalación de privilegios
ARCHIVO: src/app/api/clinic/account/ensure-role/route.ts
LINEA: 20-44, 152-169
DESCRIPCION: El endpoint POST /api/clinic/account/ensure-role no requiere autenticación del llamante. Con el service_role, resuelve un authUserId a partir de email/userId del body y muta app_metadata (role, org_id, must_set_password:false) del usuario auth. La escalación de rol está mitigada porque canAccessAsRole limita el rol efectivo a lo que la membresía en DB permite; sin embargo, no hay ninguna verificación de identidad del que llama, y limpia must_set_password para un email arbitrario.
EVIDENCIA:
  export async function POST(request: NextRequest) {
    const body = await request.json()...  // sin requireAuth
    const adminClient = createSupabaseClient(URL, SUPABASE_SERVICE_ROLE_KEY, ...);
    ...
    await adminClient.auth.admin.updateUserById(authUserId, {
      app_metadata: { ...currentAppMetadata, role, org_id: CLINIC_ORG_ID, must_set_password: false }});
ESCENARIO PARA REPRODUCIR: POST con {email:"<victima>", intendedRole:"paciente"} sin sesión. Se mutan metadatos de la cuenta destino (must_set_password:false) sin autorización del titular.
IMPACTO: Manipulación no autenticada de metadatos de cuentas ajenas; posible interferencia con el gate de "debe setear contraseña". La membresía impide asignar un rol que la víctima no tenga, lo que acota el impacto.
PROBABILIDAD: media
RECOMENDACION: Requerir autenticación/prueba de posesión (token de recuperación válido) antes de mutar app_metadata. No exponer el endpoint como POST anónimo. NO implementar aquí.
```

```
ID: SEC-007
SEVERIDAD: P2
AREA: Pagos / Protección de datos en reposo
ARCHIVO: src/lib/clinic/db/payments.ts
LINEA: 3-13, 51-70
DESCRIPCION: Los tokens OAuth de MercadoPago por profesional (access_token, refresh_token) se guardan en texto plano en la tabla payment_credentials, sin cifrado a nivel aplicación. El acceso está correctamente restringido a service_role (RLS habilitada sin policy => fail-closed para anon/authenticated, confirmado por advisor rls_enabled_no_policy sobre payment_credentials), pero el valor queda en claro en DB/backups.
EVIDENCIA:
  export interface PaymentCredentialsRow { ... access_token: string; refresh_token: string | null; ... }
  await supabase.from("payment_credentials").upsert({ professional_id, ...tokens, ... });
  // Comentario del código: "RLS blocks authenticated access to payment_credentials by design."
IMPACTO: Un compromiso de la DB o de un backup expone tokens vivos que permiten cobrar en nombre de los médicos. La restricción a service_role reduce, pero no elimina, la superficie.
PROBABILIDAD: baja
RECOMENDACION: Cifrar los tokens en reposo (pgsodium/Vault de Supabase o cifrado a nivel app) y rotarlos según expiración. NO implementar aquí.
```

```
ID: SEC-008
SEVERIDAD: P2
AREA: Autenticación / Enumeración y fuerza bruta
ARCHIVO: src/app/api/clinic/account/login/route.ts, src/app/api/clinic/account/forgot-password/route.ts
LINEA: login 24-45; forgot-password 26-33
DESCRIPCION: No hay rate-limiting en login ni en forgot-password (búsqueda de "rate limit"/"429"/"upstash" no arroja implementación real). Además, checkPortalLoginEligibility devuelve 404 con mensaje ANTES de validar la contraseña, distinguiendo cuentas registradas de no registradas (enumeración). forgot-password devuelve 404 con mensaje de elegibilidad para emails no registrados.
EVIDENCIA:
  // login: if (!eligibility.eligible) return NextResponse.json({ error: eligibility.message }, { status: 404 });
  //         luego supabase.auth.signInWithPassword(...) => 401 si password incorrecta
  // forgot-password: if (!eligibility.eligible) return ... status 404
  // rg "rate.?limit|429|upstash" src/ => sin implementación de rate limiting
ESCENARIO PARA REPRODUCIR: Sondear emails: 404 => no registrado, 401 => registrado con password incorrecta. Sin rate-limiting, iterar para enumerar cuentas y luego brute-forcear.
IMPACTO: Enumeración de usuarios (médicos/pacientes) y ausencia de freno a fuerza bruta de credenciales.
PROBABILIDAD: media
RECOMENDACION: Respuestas genéricas/uniformes (mismo status/mensaje y timing) y rate-limiting por IP/email en login, forgot-password, set-password y ensure-role. NO implementar aquí.
```

```
ID: SEC-009
SEVERIDAD: P2
AREA: Autenticación / Política de credenciales
ARCHIVO: src/app/api/clinic/account/set-password/route.ts + advisors Supabase Auth
LINEA: set-password 34-39
DESCRIPCION: La longitud mínima de contraseña es 6 caracteres, sin requisitos de complejidad. Los advisors de Supabase reportan además auth_leaked_password_protection DISABLED (no se contrasta contra HaveIBeenPwned) y auth_insufficient_mfa_options (pocas opciones de MFA habilitadas).
EVIDENCIA:
  if (password.length < 6) return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
  // Advisor WARN: "Leaked Password Protection Disabled ... Enable this feature"
  // Advisor WARN: "Insufficient MFA Options ... Enable more MFA methods"
IMPACTO: Contraseñas débiles y reutilizadas/filtradas admitidas en una app con datos clínicos; superficie de credential stuffing.
PROBABILIDAD: media
RECOMENDACION: Subir el mínimo (>=8-12) con validación de complejidad, activar leaked password protection y habilitar TOTP/MFA en Supabase Auth. NO implementar aquí.
```

```
ID: SEC-010
SEVERIDAD: P2
AREA: Base de datos / SECURITY DEFINER expuesto
ARCHIVO: Advisors Supabase (get_advisors) — esquemas public/nodo_clinica
LINEA: n/a (config de DB)
DESCRIPCION: Un advisor ERROR (security_definer_view) sobre la vista nodo_clinica.medical_specialties, y 32 funciones ejecutables por authenticated + 21 por anon como SECURITY DEFINER sin REVOKE de PUBLIC. Entre las relevantes a clínica: public.auth_user_role, public.is_assigned_doctor, nodo_clinica.current_org_id, public.user_has_node_access/user_node_role/user_node_access_reason, además de los admin_ensure_*_membership de otros nodos (autos/inmo/tienda) expuestos en el mismo API.
EVIDENCIA:
  Advisor ERROR security_definer_view: "View nodo_clinica.medical_specialties is defined with the SECURITY DEFINER property"
  Advisor WARN anon_security_definer_function_executable (21) y authenticated_... (32): p.ej. "public.is_assigned_doctor(p_patient_id uuid) can be executed by the anon role ... via /rest/v1/rpc/is_assigned_doctor"
IMPACTO: Superficie amplia de funciones privilegiadas invocables por roles bajos vía PostgREST. is_assigned_doctor/auth_user_role se usan en policies RLS; su exposición directa a anon facilita sondeo de autorización. Algunas admin_ensure_* podrían otorgar membresías (verificar cuerpo).
PROBABILIDAD: media
RECOMENDACION: REVOKE EXECUTE FROM PUBLIC/anon en todas las funciones internas; usar SECURITY INVOKER donde aplique; recrear medical_specialties como security_invoker=on. Auditar caso por caso las admin_ensure_*. NO implementar aquí.
```

```
ID: SEC-011
SEVERIDAD: P3
AREA: Base de datos / Hardening de funciones
ARCHIVO: Advisors Supabase (function_search_path_mutable)
LINEA: n/a
DESCRIPCION: 9 funciones sin search_path fijo, incluidas public.auth_user_role, public.is_assigned_doctor y public.get_my_cliente_id, que son SECURITY DEFINER usadas en control de acceso. search_path mutable en funciones SECURITY DEFINER es un patrón de hardening pendiente.
EVIDENCIA:
  Advisor WARN: "Function public.auth_user_role has a role mutable search_path"
  Advisor WARN: "Function public.is_assigned_doctor has a role mutable search_path"
IMPACTO: Riesgo (bajo en PG15+) de resolución de objetos por search_path del rol invocante en funciones SECURITY DEFINER.
PROBABILIDAD: baja
RECOMENDACION: SET search_path = pg_catalog, public (o esquema específico) en cada función. NO implementar aquí.
```

```
ID: SEC-012
SEVERIDAD: P3
AREA: Base de datos / RLS sin policy (defensa en profundidad)
ARCHIVO: Advisors Supabase (rls_enabled_no_policy)
LINEA: n/a
DESCRIPCION: 6 tablas tienen RLS habilitada pero sin policies: nodo_clinica.account_activation_tokens, health_insurances, medical_records, payment_credentials, pending_clinic_registrations y nodo_core.terms_acceptances. Esto es fail-closed (anon/authenticated no acceden; solo service_role), lo que para payment_credentials/account_activation_tokens es deseable. Se documenta porque implica que medical_records depende íntegramente del backend con service_role (sin defensa en profundidad a nivel fila) y que el control de acceso vive solo en la capa app.
EVIDENCIA:
  Advisor INFO: "Table nodo_clinica.medical_records has RLS enabled, but no policies exist"
  Advisor INFO: "Table nodo_clinica.payment_credentials has RLS enabled, but no policies exist"
IMPACTO: Cualquier bug en la capa app que use service_role sin filtrar por profesional/paciente no tiene una segunda barrera RLS. Nota: pending_clinic_registrations sin policy es coherente con que SEC-001/002 la exponen vía RPC SECURITY DEFINER — la RPC es el bypass.
PROBABILIDAD: baja
RECOMENDACION: Definir policies explícitas (o documentar la decisión de acceso solo-service_role) para medical_records y demás tablas clínicas, como defensa en profundidad. NO implementar aquí.
```

```
ID: SEC-013
SEVERIDAD: P3
AREA: Base de datos / Higiene de extensiones
ARCHIVO: Advisors Supabase (extension_in_public)
LINEA: n/a
DESCRIPCION: La extensión pg_net está instalada en el esquema public.
EVIDENCIA:
  Advisor WARN: "Extension pg_net is installed in the public schema. Move it to another schema."
IMPACTO: pg_net permite requests HTTP salientes desde la DB; en el esquema public amplía superficie si se combina con funciones/roles mal restringidos (relevante junto a SEC-010).
PROBABILIDAD: baja
RECOMENDACION: Mover pg_net a un esquema dedicado (p.ej. extensions) y restringir su uso. NO implementar aquí.
```

---

## Controles verificados como CORRECTOS (no son hallazgos)

- **`service_role` es server-only.** Los 5 usos (`src/lib/supabase/server.ts`, `src/lib/clinic/db/payments.ts`, `src/lib/clinic/onboarding-notify.ts`, `src/app/api/clinic/account/ensure-role/route.ts`, `src/app/api/clinic/account/forgot-password/route.ts`) están en libs/rutas API server-side; ninguno en componentes `"use client"`. `SUPABASE_SERVICE_ROLE_KEY` no se referencia con prefijo `NEXT_PUBLIC_` y no llega al bundle del navegador.
- **`NEXT_PUBLIC_*` no expone secretos sensibles.** Las 12 variables públicas son URLs, IDs de Jitsi/JaaS, y la anon key de Supabase (pública por diseño). Ninguna clave privada.
- **Verificador de firma del webhook** (`webhook-verify.ts`) usa `createHmac("sha256")` + `timingSafeEqual` con el manifiesto `id;request-id;ts` correcto (la debilidad está en que su invocación es condicional — ver SEC-005).
- **Aislamiento de tokens de MercadoPago:** `getProfessionalMercadoPagoAccessToken` no cae al `MERCADOPAGO_ACCESS_TOKEN` de plataforma; cada médico cobra con su propio token (evita mezclar cobros de pacientes con la facturación de suscripción de Nodo).
- **`readJwtAppMetadata`** decodifica el JWT sin verificar firma, PERO se usa sobre `session.access_token` obtenido de `supabase.auth.getSession()` (ya validado por Supabase), no sobre input arbitrario del cliente — uso aceptable.
- **`.env`** correctamente gitignoreado (`.env`, `.env*.local`, `.env*` en `.gitignore`) y sin `.env` trackeado en git.
- **No se encontraron** claves/tokens hardcodeados de Gemini, MercadoPago ni JWT dentro de `src/` (solo comparaciones de prefijo `APP_USR-` para validar configuración, no valores embebidos).

---

## Recomendaciones priorizadas

1. **Inmediato (P0/P1):** `REVOKE EXECUTE ... FROM PUBLIC, anon` en `admin_get_clinic_registrations` y `admin_delete_clinic_registration` + verificación de rol admin interna; dejar de devolver `onboarding_token` (SEC-001/002). Fail-fast del secreto de sesión en producción (SEC-003). Rotar el PAT de Supabase y moverlo a env (SEC-004).
2. **Antes de producción real (P2):** exigir `MERCADOPAGO_WEBHOOK_SECRET` (SEC-005); autenticar `ensure-role` (SEC-006); cifrar tokens OAuth en reposo (SEC-007); rate-limiting + respuestas uniformes en login/forgot-password (SEC-008); endurecer política de contraseñas y activar leaked-password protection + MFA (SEC-009); auditar y revocar funciones SECURITY DEFINER expuestas (SEC-010).
3. **Hardening (P3):** search_path fijo (SEC-011), policies RLS explícitas de defensa en profundidad (SEC-012), mover `pg_net` fuera de public (SEC-013).
```

