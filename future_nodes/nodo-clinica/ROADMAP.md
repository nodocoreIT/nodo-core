# Roadmap — Clínica Virtual (nodo-salud)

Deploy: **Vercel + GitHub** → [nodo-salud.vercel.app](https://nodo-salud.vercel.app)

---

## Fase 0 — Estabilidad (en curso)

| # | Tarea | Estado |
|---|--------|--------|
| 0.1 | Sala de espera paciente + video Jitsi funcionando en Vercel | 🔄 En progreso |
| 0.2 | Persistencia de datos en Vercel (Blob) | 🔄 En progreso |
| 0.3 | Variables de entorno documentadas (`CLINIC_MODE`, `BLOB_READ_WRITE_TOKEN`, Resend) | ⏳ |

---

## Fase 1 — Experiencia del paciente

| # | Tarea | Prioridad |
|---|--------|-----------|
| 1.1 | **Intake en sala de espera** — motivo de consulta por voz → transcripción al médico (opcional) | ✅ Hecho |
| 1.2 | Recordatorios por email (pestaña Recordatorios + Resend + reenvío manual) | ✅ Hecho |
| 1.3 | Pago simulado antes de confirmar turno (activo por defecto) | ✅ Hecho |
| 1.4 | Varios médicos / varios turnos por paciente | ✅ Hecho |

---

## Fase 2 — Pagos reales

| # | Tarea | Prioridad |
|---|--------|-----------|
| 2.1 | Integración **Mercado Pago** (preferencia de pago + webhook) | ✅ Hecho |
| 2.2 | Marcar turno "Pagado" automáticamente al confirmar webhook | ✅ Hecho |
| 2.3 | (Opcional) Stripe para pagos internacionales | Media |

---

## Fase 3 — IA y consulta médica

| # | Tarea | Prioridad |
|---|--------|-----------|
| 3.1 | Botón **"Aplicar SOAP"** — copiar SOAP generado a notas editables | ✅ Hecho |
| 3.2 | Detección de medicamentos en transcripción → sugerir receta (confirmación manual) | Media |
| 3.3 | Mejoras informe clínico + dictado | Media |

---

## Fase 4 — Recetas digitales

| # | Tarea | Prioridad |
|---|--------|-----------|
| 4.1 | PDF receta con hash SHA-256 + QR de validación | Media-alta |
| 4.2 | Portal público `/recetas/validar/[id]` para farmacias | Media-alta |
| 4.3 | Registro de receta "usada" / expirada | Media |

---

## Fase 5 — Calendario avanzado

| # | Tarea | Prioridad |
|---|--------|-----------|
| 5.1 | Google Calendar embed (vista en dashboard) | ✅ Hecho |
| 5.2 | Sincronización **bidireccional** con Google Calendar API (toggle en configuración) | Media |
| 5.3 | Bloquear turnos automáticamente si hay evento personal en Google | Media |

---

## Fase 6 — Clínica multi-profesional

| # | Tarea | Prioridad |
|---|--------|-----------|
| 6.1 | Modelo "organización / clínica" con varios médicos | Media |
| 6.2 | Consentimiento del paciente para compartir historial entre profesionales | Media |
| 6.3 | Derivaciones internas (clínico → cardiólogo misma clínica) | Baja |

---

## Orden sugerido de implementación

1. Fase 0 — video y datos estables en Vercel  
2. ~~Fase 1.1 — intake con voz~~ ✅  
3. ~~Fase 2 — Mercado Pago~~ ✅  
4. ~~Fase 3.1 — Aplicar SOAP~~ ✅  
5. **Fase 3.2 — Sugerir receta desde transcripción** ← siguiente  
6. Fase 4 — validador de recetas  
6. Fase 5.2 — Google Calendar bidireccional  
7. Fase 6 — multi-profesional  

---

## Variables Vercel recomendadas

```
NEXT_PUBLIC_CLINIC_MODE=local
CLINIC_MODE=local
BLOB_READ_WRITE_TOKEN=...   # Store → Blob (persistencia)
RESEND_API_KEY=...
RESEND_FROM_EMAIL=...
NEXT_PUBLIC_APP_URL=https://nodo-salud.vercel.app
CRON_SECRET=...             # protege /api/cron/appointment-reminders
```

**Mercado Pago (por médico):** Access Token en Configuración → Cobros. Webhook URL en MP: `https://nodo-salud.vercel.app/api/clinic/mercadopago/webhook`

**Gemini (SOAP / informes):** `GEMINI_API_KEY` en Vercel. Sin clave usa respuesta simulada.

**Cron (plan Hobby):** una ejecución al día (`0 9 * * *`). Recordatorios de 1–2 h no son fiables; preferí **1 día antes**. Pro plan permite cron cada hora.
