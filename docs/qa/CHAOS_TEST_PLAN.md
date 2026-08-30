# CHAOS / RESILIENCE TEST PLAN — Nodo Clínica

**Fecha:** 2026-08-29 · Plan (no ejecutado). Objetivo: validar comportamiento ante fallos de dependencias. Herramientas sugeridas: Chrome DevTools (Network throttling/offline), interceptores de request, toggles de env en staging. **Nunca ejecutar contra producción.**

Formato: Escenario → Acción → Resultado esperado → Riesgo real (referencia a hallazgos).

| # | Escenario | Acción | Resultado esperado | Riesgo real |
| - | --------- | ------ | ------------------ | ----------- |
| C1 | Internet offline | Cortar red durante una consulta activa | UI muestra estado offline, no pierde notas ya tipeadas; reintento al reconectar | Notas en memoria sin autosave podrían perderse |
| C2 | Slow 3G | Throttle a Slow 3G en `/pedir-turno` y checkout | Spinners, botones deshabilitados, sin doble submit | RACE-001/IDEM: doble submit puede duplicar turno |
| C3 | Supabase timeout | Latencia alta / timeout en query | Error visible, no loading eterno | ERR-002: error sólo por consola |
| C4 | Supabase 500 | Forzar 500 en una escritura clínica | Rollback/estado de error, sin persistencia parcial | CDA-003/004: persistencia parcial |
| C5 | Supabase 401 / token expirado | Expirar sesión mid-flujo | Redirect a login, sin acción a medias | SEC-003: validación de sesión |
| C6 | Realtime caído | Cortar el canal realtime del dashboard | Fallback a polling; al volver, re-sync | FE-001: polling 3 s ya cubre (redundante) |
| C7 | MercadoPago lento | Latencia en checkout/refund | Timeout controlado, sin doble cobro | IDEM-001: dup Preapproval |
| C8 | Webhook MP atrasado | Entregar webhook con retraso | Estado converge cuando llega; idempotente | PAY-003/RACE-004 |
| C9 | Webhook MP duplicado | Entregar el mismo webhook 2× | Sin doble transición de estado | Confirmación re-consulta MP (mitigado) |
| C10 | Webhook MP falso (sin firma) | POST sin firma con secret ausente | Rechazado (401) | **PAY-002: hoy fail-open** |
| C11 | Gemini caído / cuota agotada | Forzar error en generación SOAP/informe | Fallback a edición manual, sin romper la consulta | CDA-003: SOAP hoy no persiste igual |
| C12 | Email fallando | Fallar nodemailer al enviar receta | Receta guardada igual; reintento de email | Verificar que el fallo de email no aborte la creación |
| C13 | Upload fallando | Fallar subida de PDF/documento a Storage | Error visible; registro no queda huérfano | CDA-004: PDF separado del registro |
| C14 | PDF fallando | Fallar generación jspdf | Error visible, registro consistente | CDA-004 |
| C15 | Refresh mid-checkout | F5 durante el pago | No duplica turno/pago al volver | RACE-001/IDEM-003 |
| C16 | Navegador cerrado mid-consulta | Cerrar pestaña en consulta activa | Turno recuperable; estado no queda `in_consultation` trabado | RACE-005; existe acción `clearStuck` |
| C17 | Múltiples pestañas | Dos pestañas del mismo médico/paciente | Sin duplicar acciones; realtime coherente | FE-002: timers/canales por pestaña |
