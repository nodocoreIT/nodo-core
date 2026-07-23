import "server-only";
import nodemailer from "nodemailer";
import { CLINIC_BRAND_LOGO_SRC } from "@/lib/clinic/brand";

const HOST = process.env.ZOHO_SMTP_HOST ?? "smtp.zoho.com";
const PORT = Number(process.env.ZOHO_SMTP_PORT ?? 465);
const USER = process.env.ZOHO_SMTP_USER;
const PASS = process.env.ZOHO_SMTP_PASSWORD;

export function isMailConfigured(): boolean {
  return Boolean(USER && PASS);
}

function createMailTransporter() {
  return nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER!, pass: PASS! },
  });
}

function clinicFromAddress() {
  return `"Nodo Clínica" <${USER}>`;
}

export type EmailSendResult = {
  id: string;
  mock?: boolean;
};

export async function sendClinicEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: nodemailer.SendMailOptions["attachments"];
}): Promise<EmailSendResult> {
  if (!isMailConfigured()) {
    console.log("[Email Mock]", {
      to: params.to,
      subject: params.subject,
    });
    return { id: "mock-email-id", mock: true };
  }

  const transporter = createMailTransporter();
  const info = await transporter.sendMail({
    from: clinicFromAddress(),
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    attachments: params.attachments,
  });

  return { id: info.messageId ?? "sent" };
}

/**
 * Resolve the public-facing origin for email links.
 * If the request origin looks like localhost/0.0.0.0, fall back to
 * NEXT_PUBLIC_BASE_URL so emails always contain the production URL.
 */
function resolveOrigin(requestOrigin: string): string {
  const isLocal =
    !requestOrigin ||
    requestOrigin.includes("localhost") ||
    requestOrigin.includes("0.0.0.0") ||
    requestOrigin.includes("127.0.0.1");

  if (isLocal && process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  }

  return requestOrigin;
}

export async function sendPasswordResetEmail(params: {
  email: string;
  resetUrl: string;
  origin: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error(
      "SMTP not configured: set ZOHO_SMTP_USER and ZOHO_SMTP_PASSWORD",
    );
  }

  const { email, resetUrl } = params;
  const origin = resolveOrigin(params.origin);
  const logoUrl = `${origin}${CLINIC_BRAND_LOGO_SRC}`;

  const transporter = createMailTransporter();

  await transporter.sendMail({
    from: clinicFromAddress(),
    to: email,
    subject: "Restablecé tu contraseña en NODO | Clínica",
    text: [
      `Hola,`,
      ``,
      `Recibimos una solicitud para restablecer tu contraseña en NODO | Clínica.`,
      `Para crear una nueva contraseña, hacé clic en el siguiente enlace:`,
      ``,
      resetUrl,
      ``,
      `El enlace vence en 1 hora.`,
      ``,
      `Si no realizaste esta solicitud, ignorá este correo.`,
    ].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #CCEBE9;">
        <!-- Header -->
        <div style="background-color:#0D9488;padding:36px 48px;text-align:center;">
          <img
            src="${logoUrl}"
            alt="NODO Clínica"
            style="height:44px;width:auto;display:inline-block;"
          />
        </div>

        <!-- Body -->
        <div style="padding:32px;">
          <h2 style="color:#0D9488;margin-top:0;font-size:22px;">
            Restablecé tu contraseña
          </h2>
          <p style="color:#374151;font-size:15px;line-height:1.6;">
            Recibimos una solicitud para restablecer tu contraseña en
            <strong>NODO | Clínica</strong>.
            Hacé clic en el botón para crear una nueva:
          </p>
          <div style="margin:28px 0;text-align:center;">
            <a
              href="${resetUrl}"
              style="background-color:#0D9488;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;font-size:15px;letter-spacing:0.02em;"
            >
              Restablecer contraseña
            </a>
          </div>
          <p style="color:#6B7280;font-size:12px;line-height:1.5;">
            El enlace vence en 1 hora. Si el botón no funciona, copiá este
            enlace en tu navegador:<br/>
            <a href="${resetUrl}" style="color:#0D9488;word-break:break-all;">${resetUrl}</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#F0FAFA;padding:16px 32px;border-top:1px solid #CCEBE9;text-align:center;">
          <p style="color:#9CA3AF;font-size:11px;margin:0;">
            Si no realizaste esta solicitud, ignorá este correo. · © 2026 Nodo Core
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendClinicVerificationEmail(params: {
  email: string;
  role: "medico" | "paciente";
  token: string;
  origin: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error(
      "SMTP not configured: set ZOHO_SMTP_USER and ZOHO_SMTP_PASSWORD",
    );
  }

  const { email, role, token } = params;
  const origin = resolveOrigin(params.origin);
  const verificationUrl = `${origin}/api/clinic/account/verify?token=${token}&role=${role}`;
  const roleLabel = role === "medico" ? "médico" : "paciente";
  const logoUrl = `${origin}${CLINIC_BRAND_LOGO_SRC}`;

  const transporter = createMailTransporter();

  await transporter.sendMail({
    from: clinicFromAddress(),
    to: email,
    subject: "Verificá tu cuenta en NODO | Clínica",
    text: [
      `Hola,`,
      ``,
      `Gracias por registrarte como ${roleLabel} en NODO | Clínica.`,
      `Para verificar tu cuenta, hacé clic en el siguiente enlace:`,
      ``,
      verificationUrl,
      ``,
      `El enlace vence en 24 horas.`,
      ``,
      `Si no realizaste esta solicitud, ignorá este correo.`,
    ].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #CCEBE9;">
        <!-- Header -->
        <div style="background-color:#0D9488;padding:36px 48px;text-align:center;">
          <img
            src="${logoUrl}"
            alt="NODO Clínica"
            style="height:44px;width:auto;display:inline-block;"
          />
        </div>

        <!-- Body -->
        <div style="padding:32px;">
          <h2 style="color:#0D9488;margin-top:0;font-size:22px;">
            Verificá tu cuenta
          </h2>
          <p style="color:#374151;font-size:15px;line-height:1.6;margin-bottom:8px;">
            Hola,
          </p>
          <p style="color:#374151;font-size:15px;line-height:1.6;">
            Gracias por registrarte como <strong>${roleLabel}</strong> en
            <strong>NODO | Clínica</strong>.
            Para continuar con tu registro (datos personales y celular), hacé clic en el botón:
          </p>
          <div style="margin:28px 0;text-align:center;">
            <a
              href="${verificationUrl}"
              style="background-color:#0D9488;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;font-size:15px;letter-spacing:0.02em;"
            >
              Verificar y continuar registro
            </a>
          </div>
          <p style="color:#6B7280;font-size:12px;line-height:1.5;">
            El enlace vence en 24 horas. Si el botón no funciona, copiá este
            enlace en tu navegador:<br/>
            <a href="${verificationUrl}" style="color:#0D9488;word-break:break-all;">${verificationUrl}</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#F0FAFA;padding:16px 32px;border-top:1px solid #CCEBE9;text-align:center;">
          <p style="color:#9CA3AF;font-size:11px;margin:0;">
            Si no realizaste esta solicitud, ignorá este correo. · © 2026 Nodo Core
          </p>
        </div>
      </div>
    `,
  });
}
