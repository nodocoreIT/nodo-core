# RLS_MATRIX — Auditoría de Row Level Security (Nodo Clínica)

- **Proyecto Supabase:** NodoCore, `project_id = iprrlgmhpsxzyrejabtu`
- **Alcance:** políticas RLS en esquemas `nodo_clinica` (esquema ACTIVO de la app), `public`, `shared`, `nodo_core`.
- **Método:** introspección read-only sobre `pg_policies`, `pg_proc`, `pg_class`, `information_schema`, `get_advisors(security)`. Cero escrituras.
- **Hallazgo estructural clave:** la app apunta SIEMPRE a `db: { schema: "nodo_clinica" }` (`src/lib/supabase/server.ts:41`, `src/lib/supabase/clinica-auth.ts:2`, `src/lib/supabase/auth-guard.ts:43`). Las tablas clínicas del esquema `public` (`patients`, `appointments`, `clinical_records`, etc.) son un **modelo paralelo LEGACY** que la app ya no usa. El modelo vigente es multi-tenant por `org_id`.

---

## 1. Modelo de autorización vigente (`nodo_clinica`)

La frontera de aislamiento es `org_id = nodo_clinica.current_org_id()`. La función está bien construida y con `search_path` fijado:

```sql
CREATE OR REPLACE FUNCTION nodo_clinica.current_org_id()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'nodo_clinica', 'public'
AS $function$
  SELECT COALESCE(
    (SELECT org_id FROM nodo_clinica.professionals WHERE user_id = auth.uid() LIMIT 1),
    (SELECT org_id FROM nodo_clinica.patients WHERE profile_id = auth.uid() LIMIT 1),
    (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  )
$function$
```

El `org_id` se deriva de datos server-side (tablas `professionals` / `patients`), NO del JWT en el caso de staff/paciente. Esto es correcto y NO es falsificable por el cliente.

**Resultado tranquilizador:** NO se encontró ninguna fuga de LECTURA cross-tenant ni cross-paciente en el esquema activo. `staff_select_*` filtra por `org_id`; `patient_select_*` filtra por `profile_id = auth.uid()` o por `patient_id IN (patients del auth.uid())`. Un paciente no puede leer a otro paciente; un profesional no puede leer otra organización.

Los problemas encontrados son de **escritura cross-org (inyección)**, **falta de gate de admin en tablas de gestión**, y **deuda estructural (esquema legacy duplicado)**.

---

## 2. Matriz RLS — Esquema `nodo_clinica` (VIGENTE)

Columnas: `anon` | `paciente_propietario` (dueño del row) | `otro_paciente` | `profesional_de_la_org` | `profesional_de_otra_org` | `admin/super_admin (misma org)`.
Celda: verbos permitidos por RLS (S=SELECT, I=INSERT, U=UPDATE, D=DELETE). ✗ = denegado.

| Tabla | anon | paciente_propietario | otro_paciente | profesional_org | profesional_otra_org | admin/super_admin |
|---|---|---|---|---|---|---|
| `patients` | ✗ | S, U (propio, por `profile_id`) | ✗ | S, I, U (toda la org) | ✗ | S, I, U |
| `appointments` | ✗ | S, I (propio) | ✗ | S, I, U (org) | ✗ | S,I,U + **D (solo super_admin)** |
| `clinical_records` | ✗ | S (propio) | ✗ | S, I, U (org) | ✗ (ver RLS-01) | +D super_admin |
| `clinical_notes` | ✗ | S (por appointment propio) | ✗ | S, I, U (org) | ✗ (ver RLS-01) | +D super_admin |
| `soap_summaries` | ✗ | S (por appointment propio) | ✗ | S, I, U (org) | ✗ (ver RLS-01) | +D super_admin |
| `transcriptions` | ✗ | S (por appointment propio) | ✗ | S, I, U (org) | ✗ (ver RLS-01) | (sin D) |
| `prescriptions` | ✗ | S (propio) | ✗ | S, I, U (org) | ✗ (ver RLS-01) | +D super_admin |
| `study_orders` | ✗ | S (propio) | ✗ | S, I, U (org) | ✗ (ver RLS-01) | +D super_admin |
| `patient_documents` | ✗ | S/I/D (propio, docs personales sin appointment) | ✗ | S, I, U (org) | ✗ | +D super_admin |
| `patient_health_profiles` | ✗ | S, I, U, D (propio) | ✗ | S, I, U (patient∈org, **verificado bien**) | ✗ | idem |
| `professionals` | ✗ | ✗ | ✗ | **S, I, U, D (toda la org)** ← RLS-02 | ✗ | idem |
| `institutions` | (public role, null→✗) | ✗ | ✗ | **S, I, U, D (org)** ← RLS-02 | ✗ | idem |
| `in_person_availability` | (public role, null→✗) | ✗ | ✗ | **S, I, U, D (org)** ← RLS-02 | ✗ | idem |
| `office_settings` | ✗ | ✗ | ✗ | **S, I, U, D (org)** ← RLS-02 (gate admin anulado) | ✗ | S,U |
| `doctor_notifications` | ✗ | ✗ | ✗ | S, I, U, D (org) | ✗ | idem |
| `doctor_tasks` / `doctor_presence` / `chat_read_cursors` | ✗ | ✗ | ✗ | S, I, U, D (org, self por professional_id en presence/cursors) | ✗ | idem |
| `interconsult_messages` | ✗ | ✗ | ✗ | S (org), I (from_professional propio) | ✗ | idem |
| `medical_directory` | ✗ | S (`qual=true`) | S | S (cross-org) | S | S |
| `obras_sociales` | S (approved) | S | S | S | S | S |
| `pharmacy_on_call_schedules` | ✗ | S (`qual=true`) | S | S | S | S |
| `medical_specialties` (VIEW SECURITY DEFINER) | — | — | — | — | — | bypassa RLS (ver RLS-07) |
| `payment_credentials` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ (solo service_role) — RLS-05 |
| `medical_records` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ (solo service_role) — RLS-05 |
| `health_insurances` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ (solo service_role) — RLS-05 |
| `account_activation_tokens` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ (solo service_role) — RLS-05 |
| `pending_clinic_registrations` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ (solo service_role) — RLS-05 |

Notas:
- "profesional_org" = cualquier `professionals.user_id = auth.uid()` de la misma org. NO hay restricción por médico asignado / tratante: todo el staff de la org ve TODO el historial clínico de la org (ver RLS-06).
- `patient_health_profiles.staff_*` es el ÚNICO conjunto de políticas de staff que valida que el `patient_id` pertenezca a la org (`patients.org_id = current_org_id()`). El resto valida solo la columna `org_id` del propio row (raíz de RLS-01).

## 2.b Matriz RLS — Esquema `public` (clínica LEGACY, la app NO lo usa)

Modelo distinto basado en `auth_user_role()='doctor'` + `is_assigned_doctor(patient_id)` + `doctor_id = auth.uid()` + `patients.profile_id = auth.uid()`. Tablas vacías (pre-producción). Permisos DML completos (incl. TRUNCATE) para `anon` y `authenticated`, pero RLS restrictivo las gobierna (anon con `auth.uid()` NULL no lee nada). Ver RLS-03 y RLS-04.

---

## 3. Hallazgos

```
ID: RLS-01
SEVERIDAD: P2
AREA: RLS / integridad clínica cross-tenant
ARCHIVO: pg_policies (nodo_clinica.clinical_records, clinical_notes, soap_summaries, transcriptions, prescriptions, study_orders)
LINEA: políticas staff_insert_* / staff_update_*
DESCRIPCION: Las políticas de escritura de staff sobre datos clínicos validan únicamente `org_id = current_org_id()` en el WITH CHECK, pero NO validan que el `patient_id` (o `appointment_id`) referenciado pertenezca a la organización. Un profesional autenticado puede insertar/actualizar un registro clínico o receta apuntando al `patient_id` de un paciente de OTRA organización, siempre que ponga `org_id` = su propia org. Ese paciente ajeno luego LEE el row falsificado, porque `patient_select_*` filtra por `patient_id ∈ (sus patients)`, no por `org_id`.
EVIDENCIA: staff_insert_prescriptions.with_check = "(org_id = nodo_clinica.current_org_id())" (sin verificar patient_id). Contraste correcto: patient_health_profiles.staff_insert.with_check = "(patient_id IN (SELECT id FROM patients WHERE org_id = nodo_clinica.current_org_id()))". patient_select_prescriptions.qual = "(patient_id IN (SELECT id FROM patients WHERE profile_id = auth.uid()))".
ESCENARIO PARA REPRODUCIR: Profesional legítimo de la Org B obtiene (o adivina/filtra) el UUID de un patient de la Org A. Vía PostgREST con su JWT hace INSERT en nodo_clinica.prescriptions con {org_id: OrgB, patient_id: pacienteOrgA, ...}. El WITH CHECK pasa. El paciente de la Org A ve en su app una receta/orden/nota que nunca le fue emitida por su médico.
IMPACTO: Inyección de datos clínicos falsos atribuidos a un paciente de otra organización (recetas, órdenes de estudio, notas). Riesgo clínico y de integridad; potencial daño reputacional/legal. No es fuga de lectura masiva.
PROBABILIDAD: baja
RECOMENDACION: Alinear todas las políticas staff_insert_*/staff_update_* de datos clínicos al patrón de patient_health_profiles: exigir en WITH CHECK que `patient_id`/`appointment_id` pertenezca a `current_org_id()`. NO implementar aquí.
```

```
ID: RLS-02
SEVERIDAD: P2
AREA: RLS / escalación de privilegios intra-org
ARCHIVO: pg_policies (nodo_clinica.professionals, institutions, in_person_availability, office_settings)
LINEA: org_insert / org_update / org_delete / staff_update_office_settings
DESCRIPCION: Las tablas de gestión de la organización son escribibles y BORRABLES por CUALQUIER miembro autenticado de la org (rol `authenticated`, qual solo `org_id = current_org_id()`), sin gate de admin/super_admin. En `professionals` esto permite que un usuario no-admin (p.ej. recepción) INSERTE, MODIFIQUE o ELIMINE cualquier profesional de la org. En `office_settings` existe una política admin-only (`staff_update_office_settings` con role ∈ admin/super_admin) pero queda ANULADA porque coexiste la política permisiva `org_update` (cualquier autenticado); al ser PERMISSIVE se combinan con OR.
EVIDENCIA: professionals.org_delete.qual = "(org_id = nodo_clinica.current_org_id())" role={authenticated}. office_settings: org_update.qual="(org_id = current_org_id())" {authenticated} COEXISTE con staff_update_office_settings que exige role ∈ ['admin','super_admin']. Por OR permisivo, el gate admin es inútil.
ESCENARIO PARA REPRODUCIR: Profesional con rol común (no admin) de la org usa su JWT contra PostgREST: DELETE nodo_clinica.professionals WHERE id = <otro_medico> AND org_id=<su_org>; RLS lo permite. Igual para UPDATE de office_settings pese al gate admin.
IMPACTO: Cualquier miembro del staff puede borrar médicos, alterar la configuración del consultorio, crear/modificar profesionales e instituciones. DoS interno e integridad organizacional; el control admin de office_settings es efectivamente inexistente.
PROBABILIDAD: media
RECOMENDACION: Restringir INSERT/UPDATE/DELETE de professionals/institutions/in_person_availability/office_settings a admin/super_admin (o al menos separar lectura de escritura), y ELIMINAR la política permisiva `org_update`/`org_insert`/`org_delete` amplia que anula el gate. NO implementar aquí.
```

```
ID: RLS-03
SEVERIDAD: P2
AREA: RLS / superficie de ataque y deuda estructural
ARCHIVO: esquema public (patients, appointments, clinical_records, clinical_notes, transcriptions, prescriptions, study_orders, soap_summaries, patient_documents, audit_logs)
LINEA: pg_policies + information_schema.role_table_grants
DESCRIPCION: Existe un modelo clínico COMPLETO y paralelo en el esquema `public` con un esquema de RLS distinto y más débil (basado en is_assigned_doctor/auth_user_role) que la app YA NO USA (usa nodo_clinica). Estas tablas tienen grants DML completos —incluido TRUNCATE— para `anon` y `authenticated`, y `public` está expuesto por PostgREST por defecto. Están vacías hoy, pero constituyen superficie de ataque y confusión. Además `public.audit_logs` usa un modelo de tenant ajeno (`cliente_id = get_my_cliente_id()`), propio de otra app (inmo/autos), lo que evidencia contaminación de esquema.
EVIDENCIA: role_table_grants: public.patients → anon = "DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE" (idéntico para authenticated y para todas las tablas clínicas legacy). public.audit_logs policy qual = "(cliente_id = get_my_cliente_id())". La app apunta a nodo_clinica (server.ts:41, clinica-auth.ts:2).
ESCENARIO PARA REPRODUCIR: Un JWT válido puede consultar public.patients vía REST; hoy devuelve 0 filas por RLS+vacío. Si en el futuro cualquier código (o service_role) escribe ahí, aplican garantías más débiles (search_path mutable, ver RLS-04) y quedan expuestas con un modelo de doctor-asignado inconsistente con el de org.
IMPACTO: Superficie de ataque innecesaria, riesgo de divergencia de seguridad, confusión de mantenimiento, y potencial fuga si esas tablas se llegaran a poblar bajo el modelo débil.
PROBABILIDAD: baja
RECOMENDACION: Eliminar (DROP) o mover a un esquema no expuesto las tablas clínicas legacy de `public`, o como mínimo REVOKE de grants a anon/authenticated y documentarlas como deprecadas. NO implementar aquí.
```

```
ID: RLS-04
SEVERIDAD: P3
AREA: RLS / SECURITY DEFINER search_path
ARCHIVO: public.auth_user_role(), public.is_assigned_doctor(), public.get_my_cliente_id()
LINEA: definiciones de función
DESCRIPCION: Tres funciones SECURITY DEFINER que respaldan las políticas RLS del esquema public legacy NO fijan `search_path` (advisor: function_search_path_mutable). Sin search_path fijo, una función SECURITY DEFINER es susceptible de secuestro por resolución de objetos (`profiles`, `appointments`) en un esquema controlado por un atacante con privilegio de CREATE. La función vigente `nodo_clinica.current_org_id()` SÍ fija search_path (correcto), por lo que el camino ACTIVO no está afectado; el riesgo es latente y ligado a las tablas legacy de RLS-03.
EVIDENCIA: "CREATE OR REPLACE FUNCTION public.auth_user_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $function$ SELECT role FROM profiles WHERE id = auth.uid(); $function$" (sin `SET search_path`). Idem is_assigned_doctor (SELECT ... FROM appointments ...) y get_my_cliente_id (FROM public.users). get_advisors(security) las lista como role mutable search_path.
ESCENARIO PARA REPRODUCIR: Requiere que un rol pueda crear objetos en un esquema anterior en search_path y que las tablas legacy vuelvan a estar en uso. No explotable hoy por estar el path activo en nodo_clinica.
IMPACTO: Riesgo latente de bypass/escalada si se reactivan las tablas public o se otorga CREATE en public.
PROBABILIDAD: baja
RECOMENDACION: Fijar `SET search_path = ''` (o esquema explícito) en las tres funciones, o eliminarlas junto con el esquema legacy (RLS-03). NO implementar aquí.
```

```
ID: RLS-05
SEVERIDAD: P3
AREA: RLS / frontera desplazada a la API (deny-all)
ARCHIVO: nodo_clinica.payment_credentials, medical_records, health_insurances, account_activation_tokens, pending_clinic_registrations
LINEA: RLS habilitado, 0 políticas
DESCRIPCION: Cinco tablas de nodo_clinica tienen RLS habilitado y CERO políticas: bloquean a anon/authenticated por completo (deny-all, comportamiento SEGURO por defecto). Consecuencia: para estas tablas la RLS NO es la frontera de autorización real; todo acceso ocurre vía `service_role` en API routes, y la autz recae en el código de esas rutas. `payment_credentials` (credenciales MercadoPago) y `medical_records` son sensibles y deben auditarse en la capa de API.
EVIDENCIA: get_advisors(security) → rls_enabled_no_policy para nodo_clinica.payment_credentials, medical_records, health_insurances, account_activation_tokens, pending_clinic_registrations. Uso de service_role detectado en src/lib/clinic/db/payments.ts, src/app/api/clinic/account/ensure-role/route.ts, forgot-password/route.ts, src/lib/supabase/server.ts.
ESCENARIO PARA REPRODUCIR: N/A a nivel RLS (deny-all correcto). El riesgo se traslada a la autz de las rutas API que usan service_role sobre estas tablas.
IMPACTO: Si una ruta API con service_role sobre payment_credentials/medical_records no valida org/rol del llamante, se pierde el aislamiento (la RLS no protege). Requiere revisión del equipo de API/authz.
PROBABILIDAD: baja
RECOMENDACION: Confirmar en la auditoría de API que toda ruta que toca estas tablas con service_role valida sesión, org y rol. Considerar políticas RLS explícitas de respaldo aunque el acceso sea por service_role. NO implementar aquí.
```

```
ID: RLS-06
SEVERIDAD: P3
AREA: RLS / confidencialidad intra-organización
ARCHIVO: pg_policies (nodo_clinica.clinical_records, prescriptions, study_orders, clinical_notes, soap_summaries, transcriptions, patients)
LINEA: staff_select_*
DESCRIPCION: Todas las políticas de lectura de staff usan solo `org_id = current_org_id()`; NO existe restricción por médico tratante/asignado. Todo profesional de una organización puede leer el historial clínico COMPLETO de todos los pacientes de esa organización, incluidos pacientes que no atiende. Es aceptable si "org" = un único consultorio/práctica; es un problema de confidencialidad si una org agrupa múltiples médicos independientes. También `medical_directory` y `pharmacy_on_call_schedules` tienen `qual = true` (lectura cross-org), aparentemente catálogos públicos por diseño.
EVIDENCIA: staff_select_clinical_records.qual = "(org_id = nodo_clinica.current_org_id())" (sin professional_id ni is_assigned). medical_directory_select.qual = "true".
ESCENARIO PARA REPRODUCIR: Dos médicos independientes comparten la misma org_id. Médico A abre PostgREST/app y lee clinical_records de pacientes que solo atiende el Médico B.
IMPACTO: Exposición de datos clínicos entre profesionales de la misma org que no participan del tratamiento. Depende del modelo de negocio de "organización".
PROBABILIDAD: media (si el modelo de org agrupa médicos independientes)
RECOMENDACION: Confirmar el modelo de organización. Si una org puede contener médicos independientes, añadir restricción por profesional tratante (vía appointments/asignación) en staff_select de datos clínicos. NO implementar aquí.
```

```
ID: RLS-07
SEVERIDAD: P3
AREA: RLS / SECURITY DEFINER view
ARCHIVO: nodo_clinica.medical_specialties (VIEW) sobre tabla base medical_specialties
LINEA: definición de vista
DESCRIPCION: La vista `nodo_clinica.medical_specialties` es SECURITY DEFINER (advisor: security_definer_view) y la tabla base tiene RLS deshabilitada. La vista corre con privilegios del owner y evita cualquier RLS de la tabla subyacente. El contenido expuesto es un catálogo de especialidades (id, name, status), de baja sensibilidad, por lo que el impacto es bajo; se reporta por higiene de seguridad.
EVIDENCIA: get_advisors → security_definer_view en nodo_clinica.medical_specialties. viewdef = "SELECT id, name, status, created_at, updated_at FROM medical_specialties". La base tiene relrowsecurity=false.
ESCENARIO PARA REPRODUCIR: Consulta de la vista devuelve todas las filas ignorando RLS de la base.
IMPACTO: Bajo (catálogo). Riesgo relevante solo si se reutiliza el patrón SECURITY DEFINER view sobre datos sensibles.
PROBABILIDAD: baja
RECOMENDACION: Recrear la vista con `security_invoker = true` o justificar el uso. Evitar el patrón para datos sensibles. NO implementar aquí.
```

---

## 4. Notas adicionales (no-hallazgo)

- **Sin fuga de lectura cross-tenant/cross-paciente en el esquema activo:** verificado que `current_org_id()` deriva el `org_id` de tablas server-side y que las políticas de paciente usan `profile_id = auth.uid()`. Punto fuerte del diseño.
- **Políticas asignadas a rol `{public}` en vez de `{authenticated}`** (`in_person_availability`, `institutions`, `patient_health_profiles.health_profile_patient_self`): anon queda neutralizado porque `current_org_id()`/`auth.uid()` son NULL (comparación con NULL no matchea). No explotable, pero es una imprecisión de higiene; conviene fijarlas a `authenticated`.
- **`super_admin_delete_*`**: los DELETE de datos clínicos están correctamente restringidos a `role = 'super_admin'` vía JWT app_metadata. `transcriptions` no tiene política DELETE (nadie borra por RLS salvo service_role): correcto.
- **Advisors de auth ajenos a RLS** (informar al equipo de plataforma): `auth_leaked_password_protection` deshabilitado y `auth_insufficient_mfa_options`. Fuera del alcance de RLS pero conviene registrarlos.
