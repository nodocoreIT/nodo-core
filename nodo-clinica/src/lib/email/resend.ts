import "server-only";
import { currencySymbol } from "@/lib/clinic/currency";
import { sendClinicEmail, type EmailSendResult } from "@/lib/mail";
import {
  clinicEmailDocument,
  clinicEmailParagraph,
  clinicEmailTealHeader,
} from "@/lib/email/clinic-email-layout";

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
    ? clinicEmailParagraph(`📅 ${reminderNote}`)
    : "";

  const html = clinicEmailDocument(
    "Confirmación de turno",
    `
        ${clinicEmailTealHeader("Confirmación de turno")}
        <div style="padding:32px 24px;">
          ${clinicEmailParagraph(`Hola <strong>${patientName}</strong>,`)}
          ${clinicEmailParagraph(
            `Tu consulta con <strong>${doctorName}</strong> está confirmada para el <strong>${scheduledAt}</strong>.`,
          )}
          ${reminderBlock}
          ${clinicEmailParagraph(
            `Ingresá a la app como paciente para ver tu turno en <strong>Mis turnos</strong>:`,
          )}
          <div style="text-align:center;margin:32px 0;">
            <a href="${waitingRoomUrl}"
               style="background:#0f766e;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;word-wrap:break-word;">
              Ingresar como paciente
            </a>
          </div>
          ${clinicEmailParagraph(
            `<span style="color:#94a3b8;font-size:13px;line-height:1.5;display:block;">Este enlace es único y personal. No lo compartas con terceros. Podrás subir estudios previos desde la sala de espera.</span>`,
          )}
        </div>
  `,
  );

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

  const feeLabel = currencySymbol(currency);
  const feeBlock =
    consultationFee && consultationFee > 0
      ? clinicEmailParagraph(
          `Honorario de consulta: <strong>${feeLabel} ${consultationFee.toLocaleString("es-AR")}</strong>`,
        )
      : "";

  const html = clinicEmailDocument(
    "Turno asignado",
    `
        ${clinicEmailTealHeader("Turno asignado")}
        <div style="padding:32px 24px;">
          ${clinicEmailParagraph(`Hola <strong>${patientName}</strong>,`)}
          ${clinicEmailParagraph(
            `<strong>${doctorName}</strong> te asignó un turno para el <strong>${scheduledAt}</strong>.`,
          )}
          ${feeBlock}
          ${clinicEmailParagraph(
            `Para confirmar tu lugar, realizá el pago del turno desde el siguiente botón.`,
          )}
          <div style="text-align:center;margin:32px 0;">
            <a href="${loginUrl}"
               style="background:#0f766e;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
              Realizar pago
            </a>
          </div>
        </div>
  `,
  );

  return sendClinicEmail({
    to: patientEmail,
    subject: `Turno asignado — ${doctorName}`,
    html,
    text: [
      `Hola ${patientName},`,
      "",
      `${doctorName} te asignó un turno para el ${scheduledAt}.`,
      consultationFee && consultationFee > 0
        ? `Honorario: ${feeLabel} ${consultationFee.toLocaleString("es-AR")}`
        : "",
      "",
      `Realizar pago: ${loginUrl}`,
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

  const html = clinicEmailDocument(
    "Recordatorio de turno",
    `
        ${clinicEmailTealHeader("Recordatorio de turno")}
        <div style="padding:32px 24px;">
          ${clinicEmailParagraph(`Hola <strong>${patientName}</strong>,`)}
          ${clinicEmailParagraph(
            `Te recordamos que tenés consulta con <strong>${doctorName}</strong> el <strong>${scheduledAt}</strong>.`,
          )}
          <div style="text-align:center;margin:32px 0;">
            <a href="${waitingRoomUrl}"
               style="background:#0f766e;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
              Ingresar como paciente
            </a>
          </div>
          ${clinicEmailParagraph(
            `<span style="color:#94a3b8;font-size:13px;line-height:1.5;display:block;">Si no podés asistir, contactá al consultorio con anticipación.</span>`,
          )}
        </div>
  `,
  );

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
