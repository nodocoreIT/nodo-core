import "server-only";
import { CLINIC_REMINDER_LOGO_DATA_URI } from "@/lib/email/clinic-logo-data-uri";
import { sendClinicEmail, type EmailSendResult } from "@/lib/mail";

export type { EmailSendResult };

interface AppointmentEmailParams {
  patientEmail: string;
  patientName: string;
  doctorName: string;
  scheduledAt: string;
  waitingRoomUrl: string;
  reminderNote?: string;
}

export async function sendAppointmentConfirmationEmail(
  params: AppointmentEmailParams,
): Promise<EmailSendResult> {
  const {
    patientEmail,
    patientName,
    doctorName,
    scheduledAt,
    waitingRoomUrl,
    reminderNote,
  } = params;

  const reminderBlock = reminderNote
    ? `<p style="color: #64748b; line-height: 1.6; font-size: 14px;">📅 ${reminderNote}</p>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Inter', Arial, sans-serif; background: #f8fafc; padding: 32px;">
      <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 32px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Clínica Virtual</h1>
          <p style="color: #bfdbfe; margin: 8px 0 0;">Confirmación de turno</p>
        </div>
        <div style="padding: 32px;">
          <p style="color: #334155; font-size: 16px;">Hola <strong>${patientName}</strong>,</p>
          <p style="color: #64748b; line-height: 1.6;">
            Tu consulta con <strong>Dr/a. ${doctorName}</strong> está confirmada para el
            <strong>${scheduledAt}</strong>.
          </p>
          ${reminderBlock}
          <p style="color: #64748b; line-height: 1.6;">
            Al momento de tu turno, ingresa a la sala de espera virtual haciendo clic en el botón:
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${waitingRoomUrl}"
               style="background: #1e40af; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Ingresar a Sala de Espera
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
            Este enlace es único y personal. No lo compartas con terceros.
            Podrás subir estudios previos desde la sala de espera.
          </p>
        </div>
        <div style="background: #f1f5f9; padding: 16px 32px; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            © Clínica Virtual — Consulta médica segura
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendClinicEmail({
    to: patientEmail,
    subject: `Turno confirmado — Dr/a. ${doctorName}`,
    html,
    text: [
      `Hola ${patientName},`,
      "",
      `Tu consulta con Dr/a. ${doctorName} está confirmada para el ${scheduledAt}.`,
      reminderNote ?? "",
      "",
      `Sala de espera: ${waitingRoomUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

interface AppointmentReminderEmailParams {
  patientEmail: string;
  patientName: string;
  doctorName: string;
  scheduledAt: string;
  waitingRoomUrl: string;
}

export async function sendAppointmentReminderEmail(
  params: AppointmentReminderEmailParams,
): Promise<EmailSendResult> {
  const { patientEmail, patientName, doctorName, scheduledAt, waitingRoomUrl } =
    params;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Inter', Arial, sans-serif; background: #f8fafc; padding: 32px;">
      <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #0f766e, #14b8a6); padding: 32px; text-align: center;">
          <img
            src="${CLINIC_REMINDER_LOGO_DATA_URI}"
            alt="Nodo Clínica"
            style="height:44px;width:auto;display:inline-block;margin:0 auto 16px;"
          />
          <h1 style="color: white; margin: 0; font-size: 24px;">Recordatorio de turno</h1>
          <p style="color: #ccfbf1; margin: 8px 0 0;">Clínica Virtual</p>
        </div>
        <div style="padding: 32px;">
          <p style="color: #334155; font-size: 16px;">Hola <strong>${patientName}</strong>,</p>
          <p style="color: #64748b; line-height: 1.6;">
            Te recordamos que tenés consulta con <strong>Dr/a. ${doctorName}</strong> el
            <strong>${scheduledAt}</strong>.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${waitingRoomUrl}"
               style="background: #0f766e; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Ingresar a la sala de espera
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
            Si no podés asistir, contactá al consultorio con anticipación.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendClinicEmail({
    to: patientEmail,
    subject: `Recordatorio: turno con Dr/a. ${doctorName}`,
    html,
    text: [
      `Hola ${patientName},`,
      "",
      `Te recordamos que tenés consulta con Dr/a. ${doctorName} el ${scheduledAt}.`,
      "",
      `Sala de espera: ${waitingRoomUrl}`,
    ].join("\n"),
  });
}

interface PrescriptionEmailParams {
  patientEmail: string;
  patientName: string;
  doctorName: string;
  pdfBase64: string;
}

export async function sendPrescriptionEmail(
  params: PrescriptionEmailParams,
): Promise<EmailSendResult> {
  const { patientEmail, patientName, doctorName, pdfBase64 } = params;

  return sendClinicEmail({
    to: patientEmail,
    subject: `Receta médica — Dr/a. ${doctorName}`,
    html: `
      <p>Hola ${patientName},</p>
      <p>Adjuntamos tu receta médica emitida por Dr/a. ${doctorName}.</p>
      <p>Saludos,<br>Clínica Virtual</p>
    `,
    text: [
      `Hola ${patientName},`,
      "",
      `Adjuntamos tu receta médica emitida por Dr/a. ${doctorName}.`,
      "",
      "Saludos,",
      "Clínica Virtual",
    ].join("\n"),
    attachments: [
      {
        filename: "receta-medica.pdf",
        content: Buffer.from(pdfBase64, "base64"),
      },
    ],
  });
}
