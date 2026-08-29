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

interface PrescriptionMagicLinkEmailParams {
  patientEmail: string;
  patientName: string;
  doctorName: string;
  confirmUrl: string;
}

/**
 * Fase 3 of "Recetas" — sends the magic link for a standalone receta so the
 * patient can land on /paciente/receta/[accessToken] and be routed to
 * registration, login, or payment depending on their situation. Unlike
 * sendPrescriptionEmail above, this does NOT attach the PDF — the PDF only
 * becomes available after payment (Fase 4/5), so this is a separate,
 * intentionally simpler function.
 */
export async function sendPrescriptionMagicLinkEmail(
  params: PrescriptionMagicLinkEmailParams,
): Promise<EmailSendResult> {
  const { patientEmail, patientName, doctorName, confirmUrl } = params;

  const html = clinicEmailDocument(
    "Tu receta médica",
    `
        ${clinicEmailTealHeader("Tu receta médica")}
        <div style="padding:32px 24px;">
          ${clinicEmailParagraph(`Hola <strong>${patientName}</strong>,`)}
          ${clinicEmailParagraph(
            `<strong>${doctorName}</strong> te emitió una receta médica.`,
          )}
          <div style="text-align:center;margin:32px 0;">
            <a href="${confirmUrl}"
               style="background:#0f766e;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;word-wrap:break-word;">
              Confirmar receta
            </a>
          </div>
          ${clinicEmailParagraph(
            `<span style="color:#94a3b8;font-size:13px;line-height:1.5;display:block;">Este enlace es único y personal. No lo compartas con terceros.</span>`,
          )}
        </div>
  `,
  );

  return sendClinicEmail({
    to: patientEmail,
    subject: `Receta médica — Dr/a. ${doctorName}`,
    html,
    text: [
      `Hola ${patientName},`,
      "",
      `${doctorName} te emitió una receta médica.`,
      "",
      `Confirmar receta: ${confirmUrl}`,
    ].join("\n"),
  });
}

interface PrescriptionReadyEmailParams {
  patientEmail: string;
  patientName: string;
  doctorName: string;
  recetaUrl: string;
}

/**
 * Fase 4 of "Recetas" — sent right after payment confirmation, so the
 * patient knows their receta is now available. Mirrors
 * sendPrescriptionMagicLinkEmail's style; the actual PDF download is Fase 5,
 * so this just points back at the same magic-link landing page.
 */
export async function sendPrescriptionReadyEmail(
  params: PrescriptionReadyEmailParams,
): Promise<EmailSendResult> {
  const { patientEmail, patientName, doctorName, recetaUrl } = params;

  const html = clinicEmailDocument(
    "Tu receta ya está disponible",
    `
        ${clinicEmailTealHeader("Tu receta ya está disponible")}
        <div style="padding:32px 24px;">
          ${clinicEmailParagraph(`Hola <strong>${patientName}</strong>,`)}
          ${clinicEmailParagraph(
            `Confirmamos tu pago. Tu receta emitida por <strong>${doctorName}</strong> ya está lista.`,
          )}
          <div style="text-align:center;margin:32px 0;">
            <a href="${recetaUrl}"
               style="background:#0f766e;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;word-wrap:break-word;">
              Ver mi receta
            </a>
          </div>
        </div>
  `,
  );

  return sendClinicEmail({
    to: patientEmail,
    subject: `Tu receta ya está disponible — Dr/a. ${doctorName}`,
    html,
    text: [
      `Hola ${patientName},`,
      "",
      `Confirmamos tu pago. Tu receta emitida por ${doctorName} ya está lista.`,
      "",
      `Ver mi receta: ${recetaUrl}`,
    ].join("\n"),
  });
}

interface InPersonAppointmentEmailParams {
  patientEmail: string;
  patientName: string;
  doctorName: string;
  scheduledAt: string;
  waitingRoomUrl: string;
  address?: string;
  phone?: string;
  parkingNotes?: string;
  reminderNote?: string;
}

export async function sendInPersonConfirmationEmail(
  params: InPersonAppointmentEmailParams,
): Promise<EmailSendResult> {
  const {
    patientEmail,
    patientName,
    doctorName,
    scheduledAt,
    waitingRoomUrl,
    address,
    phone,
    parkingNotes,
    reminderNote,
  } = params;

  const reminderBlock = reminderNote
    ? clinicEmailParagraph(`📅 ${reminderNote}`)
    : "";

  const locationBlock = address || phone || parkingNotes
    ? clinicEmailParagraph(`
        <strong>📍 Ubicación:</strong><br>
        ${address ? `${address}<br>` : ""}
        ${phone ? `Teléfono: ${phone}<br>` : ""}
        ${parkingNotes ? `Estacionamiento: ${parkingNotes}` : ""}
      `)
    : "";

  const html = clinicEmailDocument(
    "Confirmación de turno presencial",
    `
      ${clinicEmailTealHeader("Confirmación de turno presencial")}
      <div style="padding:32px 24px;">
        ${clinicEmailParagraph(`Hola <strong>${patientName}</strong>,`)}
        ${clinicEmailParagraph(
          `Tu consulta presencial con <strong>${doctorName}</strong> está confirmada para el <strong>${scheduledAt}</strong>.`,
        )}
        ${locationBlock}
        ${reminderBlock}
        ${clinicEmailParagraph(
          `Ingresá a la app como paciente para ver tu turno en <strong>Mis turnos</strong>:`,
        )}
        <div style="text-align:center;margin:32px 0;">
          <a href="${waitingRoomUrl}"
             style="background:#0f766e;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;word-wrap:break-word;">
            Ver mi turno
          </a>
        </div>
      </div>
    `,
  );

  const textLines = [
    `Hola ${patientName},`,
    "",
    `Tu consulta presencial con ${doctorName} está confirmada para el ${scheduledAt}.`,
    "",
  ];

  if (address || phone || parkingNotes) {
    textLines.push("📍 Ubicación:");
    if (address) textLines.push(address);
    if (phone) textLines.push(`Teléfono: ${phone}`);
    if (parkingNotes) textLines.push(`Estacionamiento: ${parkingNotes}`);
    textLines.push("");
  }

  if (reminderNote) {
    textLines.push(`📅 ${reminderNote}`);
    textLines.push("");
  }

  textLines.push(`Ver mi turno: ${waitingRoomUrl}`);

  return sendClinicEmail({
    to: patientEmail,
    subject: `Turno presencial confirmado — ${doctorName}`,
    html,
    text: textLines.join("\n"),
  });
}
