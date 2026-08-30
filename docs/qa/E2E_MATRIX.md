# E2E TEST MATRIX (Playwright) — Nodo Clínica

**Fecha:** 2026-08-29 · Diseño (no se escriben los tests todavía).

## Usuarios de prueba

| Alias | Rol | Notas |
| ----- | --- | ----- |
| MEDICO_A | doctor | Con agenda y MP conectado |
| MEDICO_B | doctor | Mismo org que A — para tests cross-user |
| PACIENTE_A / PACIENTE_B | patient | Para aislamiento cross-paciente |
| PACIENTE_FREE | patient (plan gratuito) | Sin historial completo |
| PACIENTE_PAGO | patient (plan pago) | Con historial completo |
| ADMIN | admin/super_admin | Si aplica (borrado clínico) |

## Matriz

| ID | Área | Caso | Tipo | Prioridad |
| -- | ---- | ---- | ---- | --------- |
| E1 | Auth | Login/registro médico y paciente | happy | P0 |
| E2 | Auth | Recuperar/actualizar contraseña | happy | P1 |
| E3 | Auth | **Forjar cookie de sesión con secreto default → debe fallar** | security | P0 (SEC-003) |
| E4 | AuthZ | PACIENTE_A intenta leer historial de PACIENTE_B (API directa) | cross-user | P0 |
| E5 | AuthZ | MEDICO_B emite receta con doctorId = MEDICO_A → debe 403 | cross-user | P0 (CDA-001) |
| E6 | AuthZ | MEDICO_B reembolsa turno de MEDICO_A → debe 403 | cross-user | P0 (PAY-001) |
| E7 | AuthZ | MEDICO_B borra clinical_record de MEDICO_A → debe 403 | cross-user | P0 (CDA-002) |
| E8 | AuthZ | anon ejecuta RPC admin_get_clinic_registrations → debe fallar | security | P0 (SEC-001) |
| E9 | Turnos | Reserva happy path (paciente) | happy | P0 |
| E10 | Turnos | **Dos pacientes reservan el mismo slot simultáneamente → sólo uno** | race | P0 (RACE-001) |
| E11 | Turnos | Doble click en confirmar reserva → 1 turno | race | P1 (IDEM-003) |
| E12 | Turnos | Médico asigna turno manual; presencial vs virtual | happy | P1 |
| E13 | Pagos | Pago MP de turno → confirmación por webhook | happy | P0 |
| E14 | Pagos | Webhook duplicado → sin doble confirmación | idempotency | P1 |
| E15 | Pagos | Webhook sin firma (secret ausente) → rechazado | security | P1 (PAY-002) |
| E16 | Pagos | Reembolso MP happy + reintento → sin doble refund | idempotency | P1 (PAY-001) |
| E17 | Suscripción | Checkout suscripción médico doble → 1 Preapproval | idempotency | P1 (IDEM-001) |
| E18 | Plan | PACIENTE_FREE intenta ver historial completo (API) → bloqueado | subscription | P0 |
| E19 | Plan | PACIENTE_PAGO ve historial completo | subscription | P1 |
| E20 | Clínico | Emitir receta → PDF → historia clínica → email | happy | P0 |
| E21 | Clínico | Generar SOAP y persistir | happy | P1 (CDA-003 hoy rota) |
| E22 | Consulta | Videoconsulta: sala de espera → cola → consulta | happy | P0 |
| E23 | Resiliencia | Refresh mid-checkout → sin duplicar | network | P1 |
| E24 | Resiliencia | Multi-tab del mismo usuario → coherente | network | P2 |
| E25 | Errores | Supabase 500 en escritura → error visible, sin estado parcial | network | P1 |

Prioridad: P0 (bloquea release) → P3 (nice to have). Los tests marcados con hallazgo (SEC/CDA/PAY/RACE/IDEM) deben pasar sólo DESPUÉS de corregir el hallazgo; hoy documentan el fallo.
