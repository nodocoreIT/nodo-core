# MANUAL QA TEST PLAN — Nodo Clínica

**Fecha:** 2026-08-29 · Casos difíciles de automatizar. Navegadores mínimos: **Chrome, Edge, Safari**. Atención especial a **iOS** para dictado por voz.

## 1. Usabilidad del médico (consulta activa)

- [ ] Entrar a videoconsulta desde la cola; audio/video OK (Jitsi).
- [ ] Tomar notas durante la consulta; verificar autosave / no pérdida al navegar.
- [ ] Emitir receta con múltiples medicamentos; autocomplete del vademécum.
- [ ] Generar informe con IA y editarlo; confirmar persistencia (⚠️ CDA-003: SOAP hoy no persiste).
- [ ] Firmar y descargar PDF de receta/estudio.

## 2. Pérdida de conexión en consulta

- [ ] Cortar wifi 10 s durante la consulta; verificar recuperación sin perder notas.
- [ ] Cerrar la pestaña y volver a entrar; el turno no queda trabado en `in_consultation`.

## 3. Carga de archivos / PDF / impresión

- [ ] Subir comprobante de transferencia (paciente); validación IA.
- [ ] Descargar e **imprimir** receta/estudio; layout correcto en A4.
- [ ] Abrir PDF en móvil (iOS Safari / Android Chrome).

## 4. Email

- [ ] Recibir email de receta con logo correcto (ver fix previo de logo).
- [ ] Email de confirmación/recordatorio de turno; links funcionan.

## 5. Permisos y planes

- [ ] PACIENTE_FREE: confirmar que NO ve historial completo (probar también URL directa).
- [ ] PACIENTE_PAGO: acceso completo.
- [ ] Cross-user manual: intentar abrir un documento de otro paciente por URL.

## 6. Dispositivos / responsive / navegadores

- [ ] Dashboard médico en desktop (Chrome/Edge/Safari) y tablet.
- [ ] Portal paciente en móvil (iOS/Android).
- [ ] **Dictado por voz en iOS** (informe/SOAP): permisos de micrófono, precisión, botón de stop.
- [ ] Modo oscuro/claro; contraste; accesibilidad básica.

## 7. Flujos de pago (sandbox MP)

- [ ] Pago de turno con tarjeta de prueba; confirmación.
- [ ] Transferencia + comprobante + aprobación por el médico (⚠️ PAY-004: hoy puede auto-aprobar el pagador).
- [ ] Reembolso desde el panel de cobros.

## Notas

- Correr la sección 5 (permisos) también a nivel API (no sólo UI) — el frontend NO es la frontera de seguridad.
- Documentar navegador + versión + dispositivo en cada corrida.
