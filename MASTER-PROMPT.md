# MASTER PROMPT — NODO CLÍNICA PRODUCTION READINESS AUDIT

Quiero que actúes como un equipo senior multidisciplinario compuesto por:

* QA Lead con más de 20 años de experiencia.
* QA Automation Architect.
* QA Manual especializado en escenarios críticos y edge cases.
* Security Engineer / Application Security Auditor.
* Senior Supabase Architect.
* PostgreSQL Performance Engineer.
* Frontend Performance Engineer.
* Site Reliability Engineer.
* Software Architect.
* Especialista en sistemas de telemedicina.
* Especialista en integridad de datos.
* Especialista en sistemas de pagos.
* Especialista en race conditions, concurrencia e idempotencia.

Tu objetivo NO es demostrar que la aplicación funciona.

Tu objetivo es intentar demostrar que **Nodo Clínica todavía NO está preparado para producción**.

Quiero que busques activamente cualquier escenario capaz de provocar:

* pérdida de datos;
* corrupción de datos;
* datos clínicos asociados al paciente incorrecto;
* acceso no autorizado;
* fuga de información;
* vulnerabilidades;
* escalamiento de privilegios;
* bypass de suscripciones;
* errores en pagos;
* pagos duplicados;
* reembolsos duplicados;
* turnos duplicados;
* race conditions;
* estados imposibles;
* inconsistencias funcionales;
* requests innecesarios;
* consumo excesivo de Supabase;
* memory leaks;
* subscriptions Realtime duplicadas;
* polling innecesario;
* problemas de performance;
* consultas SQL ineficientes;
* falta de índices;
* errores silenciosos;
* problemas de resiliencia;
* fallos ante desconexiones;
* errores derivados de refresh, retry, doble click o múltiples pestañas;
* secretos expuestos;
* problemas de RLS;
* problemas de Storage;
* problemas de autenticación/autorización;
* cualquier situación que pudiera afectar a un médico o paciente durante el uso real.

---

# CONTEXTO

Nodo Clínica forma parte del ecosistema Nodo Core.

Nodo Core incluye:

* Nodo Dashboard.
* Nodo Clínica.
* Nodo Inmo.

Actualmente quiero auditar principalmente **Nodo Clínica**, porque comenzará a ser utilizada por un médico real en producción/modo tester.

La infraestructura principal de Nodo Clínica utiliza:

* Supabase.
* PostgreSQL.
* Supabase Auth.
* Supabase Storage.
* Supabase Realtime.
* Posiblemente Supabase Edge Functions.
* Mercado Pago.
* Jitsi/JaaS.
* IA Gemini.
* Emails transaccionales.
* Generación de PDF.
* Frontend web.

Debes descubrir la arquitectura real inspeccionando el repositorio.

NO supongas ninguna tecnología que no puedas verificar en el código.

---

# MODELO FUNCIONAL DE NODO CLÍNICA

Nodo Clínica tiene dos portales principales:

1. Médico.
2. Paciente.

---

# MÉDICO

El médico tiene:

## Autenticación y onboarding

* Login específico.
* Registro.
* DNI.
* Matrícula.
* Aceptación de términos.
* Recuperación de contraseña.
* Actualización de contraseña.
* Sistema de roles.
* Restricción de acceso relacionada con suscripciones.

## Dashboard

Incluye:

* tareas del día;
* próximos turnos;
* estadísticas;
* accesos rápidos;
* consultorio;
* turnos;
* interconsultas;
* recetas;
* estudios;
* informes.

## Consultorio

Puede:

* visualizar pacientes esperando;
* ver cola en tiempo real;
* buscar pacientes;
* consultar información clínica;
* entrar a videoconsulta;
* gestionar notas;
* revisar historial;
* emitir documentos;
* consultar alertas clínicas.

## Agenda

Puede configurar:

* días de trabajo;
* horarios;
* múltiples franjas horarias;
* duración de los turnos;
* días libres;
* feriados;
* instituciones donde trabaja;
* agenda presencial;
* agenda virtual.

Puede:

* asignar turnos manualmente;
* cancelar turnos;
* visualizar calendario;
* gestionar turnos programados.

## Recetas

Permite:

* múltiples medicamentos;
* búsqueda/autocomplete en vademécum;
* firma médica;
* generación PDF;
* envío por email;
* almacenamiento;
* incorporación automática a historia clínica.

## Estudios

Permite:

* solicitar estudios;
* múltiples estudios;
* catálogo;
* etiquetas personalizadas;
* observaciones;
* PDF firmado;
* almacenamiento en historia clínica.

## Informe clínico con IA

Permite:

* texto;
* dictado por voz;
* generación con IA;
* edición;
* resumen SOAP;
* PDF;
* firma;
* persistencia.

Existe fallback cuando la IA no está disponible o se agota la cuota.

## Historia clínica

Incluye potencialmente:

* consultas;
* notas;
* recetas;
* estudios;
* informes;
* documentos;
* archivos subidos por pacientes.

## Cobros

Permite:

* visualizar pagos;
* filtrar pagos;
* Mercado Pago;
* transferencias;
* comprobantes;
* validación mediante IA;
* aprobación manual;
* rechazo;
* reembolsos;
* libro contable;
* datos bancarios.

## Interconsultas / Nodo Chat

Comunicación entre profesionales.

Puede estar restringida según suscripción.

## Configuración

Puede incluir:

* perfil;
* matrícula;
* especialidad;
* foto;
* firma;
* Google Calendar;
* cobros;
* días libres;
* apariencia;
* suscripciones.

---

# PACIENTE

## Autenticación

Tiene:

* login separado;
* registro;
* DNI;
* información personal;
* dirección;
* obra social;
* detección de DNI duplicado.

## Planes

Existen al menos:

### Plan gratuito

Permite:

* solicitar turnos;
* turnos presenciales;
* turnos virtuales;
* visualizar recetas.

No permite acceder al historial clínico completo.

### Plan pago

Aproximadamente USD 5.

Habilita acceso a funcionalidades completas incluyendo historial clínico.

IMPORTANTE:

No debes confiar en restricciones de frontend.

Debes verificar que esta separación esté protegida realmente a nivel backend, base de datos, RLS, API o arquitectura equivalente.

## Dashboard

Incluye:

* accesos rápidos;
* turnos;
* estudios;
* historial;
* búsqueda de médicos;
* farmacias;
* potencial geolocalización;
* laboratorios;
* diagnóstico por imágenes.

## Reserva de turnos

Incluye:

* búsqueda de médico;
* especialidad;
* matrícula;
* horarios;
* fecha;
* pago;
* Mercado Pago;
* transferencia;
* comprobante;
* validación IA;
* motivo de consulta;
* dictado;
* estudios previos;
* confirmación.

## Turnos

Estados potenciales:

* programado;
* pago pendiente;
* en revisión;
* en espera;
* en consulta;
* finalizado;
* cancelado.

Verifica cuáles existen realmente.

## Sala de espera

Incluye:

* validación de pago;
* posición en cola;
* motivo;
* estudios;
* documentos;
* detección de médico disponible;
* videoconsulta.

## Historial clínico

Timeline de:

* consultas;
* recetas;
* estudios;
* informes.

Debe estar restringido según plan.

## Mi Salud

Puede contener:

* fecha nacimiento;
* sexo;
* altura;
* peso;
* IMC;
* grupo sanguíneo;
* alergias;
* enfermedades;
* medicación;
* contacto de emergencia.

Estos datos pueden ser utilizados como alertas clínicas por médicos.

## Documentos

Puede visualizar:

* PDFs;
* recetas;
* estudios;
* informes;
* comprobantes.

---

# SISTEMAS TRANSVERSALES

Nodo Clínica utiliza o puede utilizar:

## Supabase Realtime

Turnos, cola de espera, documentos u otros eventos.

Debes investigar todas las subscriptions.

## Persistencia

Puede existir:

* Supabase producción.
* JSON/local/demo.

Debes identificar diferencias de comportamiento.

## IA

Gemini puede utilizarse para:

* informes;
* SOAP;
* validación de comprobantes.

## PDF

Recetas, estudios e informes.

## Mercado Pago

Puede existir:

* Checkout Pro;
* OAuth;
* webhooks;
* reembolsos;
* suscripciones;
* pagos de consultas.

## Emails

Posibles emails:

* confirmación turno;
* recordatorio;
* receta;
* documentos.

---

# PRINCIPIO FUNDAMENTAL DE ESTA AUDITORÍA

NO QUIERO QUE MODIFIQUES CÓDIGO TODAVÍA.

Esta primera fase es completamente:

# READ ONLY

No debes:

* refactorizar;
* corregir;
* optimizar;
* cambiar archivos de aplicación;
* cambiar migraciones;
* modificar base de datos;
* modificar RLS;
* instalar librerías;
* cambiar configuración;
* ejecutar migraciones destructivas;
* eliminar archivos;
* modificar variables de entorno;
* tocar producción.

Puedes crear exclusivamente documentación dentro de:

`/docs/qa/`

Puedes crear scripts de análisis dentro de:

`/scripts/qa-audit/`

ÚNICAMENTE si no modifican datos y son estrictamente read-only.

---

# FASE 1 — ARQUITECTURA

Recorre TODO el repositorio.

Necesito que entiendas:

* estructura;
* módulos;
* frontend;
* backend;
* Supabase;
* autenticación;
* autorización;
* modelo de datos;
* pagos;
* realtime;
* storage;
* Edge Functions;
* APIs externas;
* IA;
* emails;
* PDFs;
* roles;
* planes;
* subscriptions;
* feature flags;
* localStorage;
* sessionStorage;
* cookies.

Construye:

`/docs/qa/ARCHITECTURE_MAP.md`

Incluye:

* tecnologías;
* rutas;
* módulos;
* servicios;
* dependencias importantes;
* APIs;
* Supabase;
* integraciones;
* flujos principales.

NO describas simplemente carpetas.

Quiero entender cómo circulan los datos.

---

# FASE 2 — MODELO DE DATOS

Analiza completamente:

* tablas;
* columnas;
* relaciones;
* PK;
* FK;
* constraints;
* índices;
* triggers;
* functions;
* views;
* policies;
* enums;
* estados;
* Storage buckets.

Crear:

`/docs/qa/DATA_MODEL_AUDIT.md`

Identifica:

* relaciones peligrosas;
* falta de constraints;
* FK faltantes;
* cascades peligrosos;
* campos nullable problemáticos;
* duplicaciones posibles;
* falta de unique constraints;
* estados inválidos;
* entidades huérfanas.

---

# FASE 3 — SECURITY AUDIT

Este es uno de los puntos más importantes.

Realiza una auditoría completa.

Debes analizar como mínimo:

* Auth;
* JWT;
* sesiones;
* roles;
* permisos;
* RLS;
* Storage policies;
* Edge Functions;
* APIs;
* RPC;
* views;
* variables de entorno;
* secrets;
* URLs;
* logs;
* localStorage;
* sessionStorage;
* bundles;
* middleware;
* navegación;
* protección server-side/backend.

Busca específicamente:

* `service_role`;
* service keys;
* secrets;
* Mercado Pago tokens;
* Gemini keys;
* private keys;
* passwords;
* credenciales;
* tokens hardcodeados.

Buscar también potencial exposición mediante:

* `NEXT_PUBLIC_*`;
* `VITE_*`;
* frontend bundles;
* console.log;
* source maps;
* error messages.

Crear:

`/docs/qa/SECURITY_AUDIT.md`

---

# FASE 4 — RLS

Inspecciona TODAS las tablas accesibles mediante Supabase.

Crear:

`/docs/qa/RLS_MATRIX.md`

Quiero una tabla similar a:

| recurso         | anon | paciente propietario | otro paciente | médico autorizado | otro médico | admin |
| --------------- | ---- | -------------------- | ------------- | ----------------- | ----------- | ----- |
| appointments    |      |                      |               |                   |             |       |
| prescriptions   |      |                      |               |                   |             |       |
| medical_records |      |                      |               |                   |             |       |
| payments        |      |                      |               |                   |             |       |

Pero adaptada al esquema REAL.

Debes revisar:

* SELECT;
* INSERT;
* UPDATE;
* DELETE.

No consideres segura una tabla simplemente porque tiene una policy SELECT.

Analiza TODAS las operaciones.

Buscar particularmente:

* ownership modificable;
* `user_id` editable;
* `doctor_id` editable;
* `patient_id` editable;
* acceso mediante query manipulada;
* bypass del frontend;
* policies demasiado amplias;
* `USING true`;
* `WITH CHECK` incorrecto;
* tablas sin RLS;
* views que salteen protección;
* funciones `security definer`.

---

# FASE 5 — INTEGRIDAD CLÍNICA

Crear:

`/docs/qa/CLINICAL_DATA_AUDIT.md`

Analiza operaciones que involucren:

* historia clínica;
* consulta;
* receta;
* estudios;
* informes;
* notas;
* archivos;
* paciente;
* médico.

Busca cualquier situación donde pueda producirse:

* documento asignado a paciente incorrecto;
* doctor incorrecto;
* receta duplicada;
* historial incompleto;
* operación parcialmente persistida;
* registros huérfanos;
* actualización accidental;
* overwrite de información;
* datos inconsistentes.

Identifica operaciones que actualmente realizan múltiples pasos independientes.

Ejemplo:

crear receta →

1. insertar receta;
2. insertar medicamentos;
3. crear PDF;
4. subir PDF;
5. agregar historia;
6. generar notificación;
7. enviar email.

Analiza qué ocurre si falla cada paso.

Identifica operaciones que deberían ser:

* transaccionales;
* idempotentes;
* atómicas.

---

# FASE 6 — PAGOS

Crear:

`/docs/qa/PAYMENT_AUDIT.md`

Analiza completamente:

* Mercado Pago;
* transferencias;
* comprobantes;
* suscripciones;
* checkout;
* webhooks;
* reembolsos;
* estados.

Buscar:

* webhook duplicado;
* webhook fuera de orden;
* webhook atrasado;
* webhook falso;
* pago duplicado;
* refund duplicado;
* estado local diferente a Mercado Pago;
* pago confirmado pero turno sin crear;
* turno creado pero pago no confirmado;
* refresh durante checkout;
* doble click;
* timeout;
* retry;
* usuario manipulando monto;
* usuario manipulando doctor;
* usuario manipulando appointment_id;
* usuario aprobando su propio pago.

Auditar idempotencia.

---

# FASE 7 — TURNOS Y CONCURRENCIA

Crear:

`/docs/qa/RACE_CONDITIONS.md`

Quiero que analices escenarios concurrentes.

Especialmente:

Paciente A y Paciente B intentan reservar simultáneamente:

* mismo médico;
* mismo día;
* mismo horario.

Determina si la DB garantiza que únicamente uno pueda reservar.

NO aceptes validación frontend como solución.

Busca:

* unique constraints;
* transactions;
* locks;
* RPC;
* atomic operations.

Analiza también:

* médico cancela mientras paciente paga;
* paciente cancela mientras médico inicia consulta;
* dos pestañas;
* dos dispositivos;
* doble submit;
* retry automático;
* Realtime concurrente.

---

# FASE 8 — IDEMPOTENCIA

Audita todas las acciones importantes.

Crear:

`/docs/qa/IDEMPOTENCY_AUDIT.md`

Especialmente:

* crear turno;
* pagar;
* confirmar pago;
* reembolsar;
* crear receta;
* emitir estudio;
* guardar informe;
* finalizar consulta;
* subir documento;
* enviar email;
* webhook.

Simula conceptualmente:

* doble click;
* retry;
* timeout;
* reconnect;
* request duplicada;
* webhook duplicado.

Indicar qué operaciones podrían duplicarse.

---

# FASE 9 — SUPABASE INFRASTRUCTURE AUDIT

Crear:

`/docs/qa/SUPABASE_AUDIT.md`

Analiza:

* queries;
* Storage;
* Auth;
* Realtime;
* funciones;
* Edge Functions;
* DB;
* índices;
* egress.

Buscar:

* `select('*')` innecesario;
* columnas innecesarias;
* consultas repetidas;
* N+1;
* consultas sin filtros;
* listas sin paginación;
* búsquedas sin debounce;
* polling agresivo;
* polling + Realtime simultáneo;
* listeners duplicados;
* channels que no se destruyen;
* Realtime demasiado amplio;
* consultas ejecutadas en cada render;
* `useEffect` incorrectos;
* query loops;
* refetch innecesario;
* archivos descargados repetidamente;
* imágenes sin optimizar;
* PDFs descargados innecesariamente.

Buscar explícitamente:

```ts
supabase
  .from(...)
  .select('*')
```

y equivalentes.

NO asumas que es incorrecto automáticamente.

Analiza contexto.

---

# FASE 10 — MAPA DE REQUESTS

Quiero que inspecciones todas las pantallas principales.

Crear:

`/docs/qa/NETWORK_REQUEST_MAP.md`

Para cada ruta identifica:

* request inicial;
* request secundaria;
* Supabase query;
* Realtime;
* polling;
* Storage;
* APIs externas;
* posibles duplicaciones.

Ejemplos:

* `/medico/dashboard`
* `/medico/consultorio`
* `/medico/turnos`
* `/medico/cobros`
* `/paciente/dashboard`
* `/paciente/turnos`
* `/paciente/historial`

Usa rutas reales.

---

# FASE 11 — FRONTEND PERFORMANCE

Crear:

`/docs/qa/FRONTEND_PERFORMANCE_AUDIT.md`

Buscar:

* rerenders;
* componentes pesados;
* bundle size;
* imports;
* lazy loading;
* imágenes;
* memoización;
* efectos;
* listeners;
* intervalos;
* memory leaks;
* websockets;
* React Query/SWR si existe;
* caches;
* fetch duplicado;
* estado global.

No hagas micro-optimizaciones irrelevantes.

Prioriza problemas que generen:

* requests;
* CPU;
* memoria;
* latencia;
* costos Supabase;
* UX mala.

---

# FASE 12 — ERROR HANDLING

Crear:

`/docs/qa/ERROR_HANDLING_AUDIT.md`

Buscar:

* `try/catch` vacíos;
* errores ignorados;
* promises sin await;
* promises no manejadas;
* operaciones que continúan luego de error;
* errores mostrados solamente por console.log;
* estados loading eternos;
* pantalla blanca;
* botones que quedan bloqueados;
* errores Supabase ignorados.

Especialmente revisar patrones como:

```ts
const { data } = await supabase...
```

sin revisar:

```ts
error
```

---

# FASE 13 — RESILIENCIA / CHAOS

Crear:

`/docs/qa/CHAOS_TEST_PLAN.md`

Diseña escenarios para:

* internet offline;
* Slow 3G;
* Supabase timeout;
* Supabase 500;
* Supabase 401;
* token expirado;
* Realtime caído;
* Mercado Pago lento;
* webhook retrasado;
* webhook duplicado;
* Gemini caído;
* email fallando;
* upload fallando;
* PDF fallando;
* refresh;
* browser cerrado;
* múltiples pestañas.

Para cada uno especifica:

* acción;
* resultado esperado;
* posible riesgo.

---

# FASE 14 — PLAYWRIGHT MASTER TEST MATRIX

NO escribas todavía todos los tests.

Primero diseña.

Crear:

`/docs/qa/E2E_MATRIX.md`

Usuarios requeridos como mínimo:

* MEDICO_A;
* MEDICO_B;
* PACIENTE_A;
* PACIENTE_B;
* PACIENTE_FREE;
* PACIENTE_PAGO;
* ADMIN si corresponde.

Diseña:

* happy paths;
* unhappy paths;
* edge cases;
* authorization tests;
* cross-user tests;
* subscription tests;
* payments;
* race conditions;
* refresh;
* multiple tabs;
* network errors.

Clasifica cada test:

* P0;
* P1;
* P2;
* P3.

---

# FASE 15 — LOAD TEST PLAN

Crear:

`/docs/qa/LOAD_TEST_PLAN.md`

Diseña pruebas con k6 o herramienta equivalente.

Carga propuesta:

* 10 usuarios;
* 25;
* 50;
* 100;
* 250.

Simular:

* login;
* dashboard;
* médicos;
* búsqueda;
* turnos;
* agenda;
* historia;
* operaciones comunes.

Definir:

* p50;
* p95;
* p99;
* error rate;
* DB latency;
* connections;
* CPU;
* memory;
* egress;
* Realtime.

NO ejecutar carga destructiva contra producción.

---

# FASE 16 — BACKUPS Y RECOVERY

Crear:

`/docs/qa/BACKUP_RECOVERY_AUDIT.md`

Determinar:

* estrategia actual;
* backups DB;
* Storage;
* recuperación;
* RPO;
* RTO;
* riesgos.

Responder concretamente:

> Si mañana alguien elimina accidentalmente historias clínicas, recetas, estudios o documentos, ¿cómo se recuperan?

Diferenciar:

* base de datos;
* Supabase Storage.

---

# FASE 17 — OBSERVABILIDAD

Crear:

`/docs/qa/OBSERVABILITY_AUDIT.md`

Analiza si puedo detectar:

* frontend crash;
* API failure;
* Edge Function error;
* pago fallido;
* webhook fallido;
* email fallido;
* PDF fallido;
* upload fallido;
* slow query;
* Realtime error.

Investiga si existen:

* error monitoring;
* correlation IDs;
* request IDs;
* structured logs.

IMPORTANTE:

No recomendar logging indiscriminado de información clínica.

Priorizar privacidad.

---

# FASE 18 — MANUAL QA

Crear:

`/docs/qa/MANUAL_TEST_PLAN.md`

Quiero casos difíciles de automatizar.

Especialmente:

* usabilidad médico;
* pérdida de conexión en consulta;
* navegación;
* mensajes;
* carga de archivos;
* PDF;
* impresión;
* email;
* permisos;
* dispositivos;
* responsive;
* diferentes navegadores.

Browsers mínimos:

* Chrome;
* Edge;
* Safari si corresponde.

Considerar especialmente iOS para funcionalidades de dictado.

---

# SEVERIDADES

Clasifica TODO hallazgo:

## P0 BLOCKER

No puede salir a producción.

Ejemplos:

* exposición de datos;
* RLS roto;
* service_role expuesta;
* corrupción clínica;
* receta paciente incorrecto;
* pago duplicado;
* refund duplicado;
* acceso cruzado.

## P1 CRITICAL

Debe corregirse antes del uso real.

## P2 MAJOR

Puede existir workaround pero debe planificarse.

## P3 MINOR

UX, cosmética o mejora.

---

# NO QUIERO FALSOS POSITIVOS

Cada hallazgo debe incluir evidencia.

Formato obligatorio:

```text
ID:
SEVERIDAD:
ÁREA:
ARCHIVO:
LÍNEA:
DESCRIPCIÓN:
EVIDENCIA:
ESCENARIO PARA REPRODUCIR:
IMPACTO:
PROBABILIDAD:
RECOMENDACIÓN:
```

No reportes vulnerabilidades basadas únicamente en posibilidades teóricas si el código demuestra que están mitigadas.

---

# BUG REPORT

Crear:

`/docs/qa/BUG_REPORT.md`

Ordenar:

1. P0;
2. P1;
3. P2;
4. P3.

---

# RISK REGISTER

Crear:

`/docs/qa/RISK_REGISTER.md`

Cada riesgo debe contener:

| Riesgo | Probabilidad | Impacto | Severidad | Evidencia | Mitigación |
| ------ | ------------ | ------- | --------- | --------- | ---------- |

---

# MASTER TEST PLAN

Crear:

`/docs/qa/MASTER_TEST_PLAN.md`

Debe resumir toda la estrategia de certificación.

---

# PRODUCTION READINESS

Finalmente crear:

`/docs/qa/PRODUCTION_READINESS.md`

Debe responder:

# GO / CONDITIONAL GO / NO-GO

Y evaluar:

```text
P0 abiertos
P1 abiertos

Functional regression
Security
RLS
Clinical integrity
Payments
Idempotency
Concurrency
Supabase
Performance
Realtime
Storage
Error handling
Backups
Observability
E2E readiness
Load testing readiness
```

Usa:

* PASS;
* FAIL;
* PARTIAL;
* NOT TESTED.

---

# RELEASE GATE

La aplicación sólo debería considerarse lista cuando potencialmente alcance:

```text
P0 abiertos: 0

P1 abiertos: 0

Regresión crítica: 100% PASS

Security audit: PASS

RLS: PASS

Cross-user isolation: PASS

Clinical data integrity: PASS

Payments: PASS

Idempotency: PASS

Race conditions: PASS

Secrets exposure: PASS

E2E críticos: PASS

Supabase performance: PASS

Frontend performance: PASS

Load test: PASS

Backup recovery: PASS

Unhandled exceptions críticas: 0

5xx en flujos normales: 0
```

Si consideras que algún criterio debe cambiar, explica por qué.

---

# FORMA DE TRABAJAR

Quiero que seas extremadamente riguroso.

NO hagas una revisión superficial.

NO revises solamente componentes principales.

Recorre:

* aplicación;
* Supabase;
* migrations;
* SQL;
* policies;
* functions;
* hooks;
* services;
* APIs;
* middleware;
* stores;
* utils;
* auth;
* payments;
* realtime;
* storage.

Haz búsquedas globales por patrones sospechosos.

Relaciona frontend con backend.

Relaciona acciones de UI con persistencia.

Relaciona entidades entre sí.

Piensa como atacante.

Piensa como usuario torpe.

Piensa como médico con una consulta activa.

Piensa como paciente utilizando dos pestañas.

Piensa como sistema bajo latencia.

Piensa como webhook duplicado.

Piensa como Supabase devolviendo error.

Piensa como un QA intentando romper el sistema.

---

# MUY IMPORTANTE

No corrijas nada todavía.

Primero quiero conocer la verdad sobre el estado actual.

Si encuentras un P0, NO detengas la auditoría.

Documentalo inmediatamente y continúa buscando otros problemas.

No quiero que el primer bug crítico encontrado haga que abandones el análisis.

---

# ORDEN DE PRIORIDAD

Prioriza:

1. Seguridad.
2. RLS.
3. Privacidad.
4. Integridad clínica.
5. Pagos.
6. Turnos.
7. Concurrencia.
8. Idempotencia.
9. Persistencia.
10. Supabase.
11. Realtime.
12. Performance.
13. Error handling.
14. UX.
15. Mejoras menores.

---

# ENTREGA FINAL

Al finalizar quiero como mínimo:

```text
/docs/qa/

ARCHITECTURE_MAP.md
MASTER_TEST_PLAN.md
DATA_MODEL_AUDIT.md
SECURITY_AUDIT.md
RLS_MATRIX.md
CLINICAL_DATA_AUDIT.md
PAYMENT_AUDIT.md
RACE_CONDITIONS.md
IDEMPOTENCY_AUDIT.md
SUPABASE_AUDIT.md
NETWORK_REQUEST_MAP.md
FRONTEND_PERFORMANCE_AUDIT.md
ERROR_HANDLING_AUDIT.md
CHAOS_TEST_PLAN.md
E2E_MATRIX.md
LOAD_TEST_PLAN.md
BACKUP_RECOVERY_AUDIT.md
OBSERVABILITY_AUDIT.md
MANUAL_TEST_PLAN.md
BUG_REPORT.md
RISK_REGISTER.md
PRODUCTION_READINESS.md
```

Al terminar, además de generar esos documentos, mostrámelo en consola con este resumen:

```text
========================================
NODO CLÍNICA — PRODUCTION AUDIT
========================================

P0 BLOCKERS:
P1 CRITICAL:
P2 MAJOR:
P3 MINOR:

SECURITY:
RLS:
CLINICAL DATA:
PAYMENTS:
TURNOS:
CONCURRENCY:
IDEMPOTENCY:
SUPABASE:
REALTIME:
PERFORMANCE:
BACKUPS:
OBSERVABILITY:

PRODUCTION STATUS:

GO
CONDITIONAL GO
o
NO-GO

TOP 10 RISKS:
1.
2.
3.
4.
5.
6.
7.
8.
9.
10.

NEXT RECOMMENDED PHASE:
```

No minimices los problemas.

No supongas que algo funciona porque parece correcto.

Verifica mediante código, configuración, SQL, flujo y evidencia.

Tu misión durante esta fase es encontrar todo aquello que podría hacer que Nodo Clínica falle cuando empiece a utilizarse con médicos y pacientes reales.
