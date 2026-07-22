import "server-only";
import { CLINIC_REMINDER_LOGO_DATA_URI } from "@/lib/email/clinic-logo-data-uri";
import { sendClinicEmail, type EmailSendResult } from "@/lib/mail";

export type { EmailSendResult };

function clinicEmailTealHeader(title: string): string {
  return `
        <div style="background: linear-gradient(135deg, #0f766e, #14b8a6); padding: 32px; text-align: center;">
          <img
            src="${CLINIC_REMINDER_LOGO_DATA_URI}"
            alt="Nodo Clínica"
            style="height:44px;width:auto;display:inline-block;margin:0 auto 16px;"
          />
          <h1 style="color: white; margin: 0; font-size: 24px;">${title}</h1>
        </div>`;
}

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
            Tu consulta con <strong>${doctorName}</strong> está confirmada para el
            <strong>${scheduledAt}</strong>.
          </p>
          ${reminderBlock}
          <p style="color: #64748b; line-height: 1.6;">
            Ingresá a la app como paciente para ver tu turno en <strong>Mis turnos</strong>:
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${waitingRoomUrl}"
               style="background: #1e40af; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Ingresar como paciente
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
    subject: `Turno confirmado — ${doctorName}`,
    html,
    text: [
      `Hola ${patientName},`,
      "",
      `Tu consulta con ${doctorName} está confirmada para el ${scheduledAt}.`,
      reminderNote ?? "",
      "",
      `Ingresar como paciente: ${waitingRoomUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

interface DoctorAssignedAppointmentEmailParams {
  patientEmail: string;
  patientName: string;
  doctorName: string;
  scheduledAt: string;
  loginUrl: string;
  consultationFee?: number;
  currency?: string;
}

export async function sendDoctorAssignedAppointmentEmail(
  params: DoctorAssignedAppointmentEmailParams,
): Promise<EmailSendResult> {
  const {
    patientEmail,
    patientName,
    doctorName,
    scheduledAt,
    loginUrl,
    consultationFee,
    currency = "ARS",
  } = params;

  const feeBlock =
    consultationFee && consultationFee > 0
      ? `<p style="color: #64748b; line-height: 1.6;">
           Honorario de consulta: <strong>${currency} ${consultationFee.toLocaleString("es-AR")}</strong>
         </p>`
      : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Inter', Arial, sans-serif; background: #f8fafc; padding: 32px;">
      <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
        ${clinicEmailTealHeader("Turno asignado")}
        <div style="padding: 32px;">
          <p style="color: #334155; font-size: 16px;">Hola <strong>${patientName}</strong>,</p>
          <p style="color: #64748b; line-height: 1.6;">
            <strong>${doctorName}</strong> te asignó un turno para el
            <strong>${scheduledAt}</strong>.
          </p>
          ${feeBlock}
          <p style="color: #64748b; line-height: 1.6;">
            Para confirmar tu lugar, ingresá a la app, andá a <strong>Mis turnos</strong>
            y completá el pago del turno.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${loginUrl}"
               style="background: #0f766e; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Ingresar y completar pago
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendClinicEmail({
    to: patientEmail,
    subject: `Turno asignado — ${doctorName}`,
    html,
    text: [
      `Hola ${patientName},`,
      "",
      `${doctorName} te asignó un turno para el ${scheduledAt}.`,
      consultationFee && consultationFee > 0
        ? `Honorario: ${currency} ${consultationFee}`
        : "",
      "",
      `Ingresá como paciente: ${loginUrl}`,
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
        ${clinicEmailTealHeader("Recordatorio de turno")}
        <div style="padding: 32px;">
          <p style="color: #334155; font-size: 16px;">Hola <strong>${patientName}</strong>,</p>
          <p style="color: #64748b; line-height: 1.6;">
            Te recordamos que tenés consulta con <strong>${doctorName}</strong> el
            <strong>${scheduledAt}</strong>.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${waitingRoomUrl}"
               style="background: #0f766e; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Ingresar como paciente
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
    subject: `Recordatorio: turno con ${doctorName}`,
    html,
    text: [
      `Hola ${patientName},`,
      "",
      `Te recordamos que tenés consulta con ${doctorName} el ${scheduledAt}.`,
      "",
      `Ingresar como paciente: ${waitingRoomUrl}`,
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
