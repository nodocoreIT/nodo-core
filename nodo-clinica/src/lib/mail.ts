import "server-only";
import nodemailer from "nodemailer";

const HOST = process.env.ZOHO_SMTP_HOST ?? "smtp.zoho.com";
const PORT = Number(process.env.ZOHO_SMTP_PORT ?? 465);
const USER = process.env.ZOHO_SMTP_USER;
const PASS = process.env.ZOHO_SMTP_PASSWORD;

export function isMailConfigured(): boolean {
  return Boolean(USER && PASS);
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
  const logoUrl = `${origin}/logos/nodo%20ver%20clinica.png`;

  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
  });

  await transporter.sendMail({
    from: `"Nodo Clínica" <${USER}>`,
    to: email,
    subject: "Verificá tu cuenta en NODO | Clínica Virtual",
    text: [
      `Hola,`,
      ``,
      `Gracias por registrarte como ${roleLabel} en NODO | Clínica Virtual.`,
      `Para verificar tu cuenta, hacé clic en el siguiente enlace:`,
      ``,
      verificationUrl,
      ``,
      `El enlace vence en 24 horas.`,
      ``,
      `Si no realizaste esta solicitud, ignorá este correo.`,
    ].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #CCEBE9;">
        <!-- Header -->
        <div style="background-color:#0D9488;padding:28px 32px;text-align:center;">
          <img
            src="${logoUrl}"
            alt="NODO Clínica"
            style="height:32px;width:auto;display:inline-block;"
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
            <strong>NODO | Clínica Virtual</strong>.
            Para activar tu cuenta hacé clic en el botón:
          </p>
          <div style="margin:28px 0;text-align:center;">
            <a
              href="${verificationUrl}"
              style="background-color:#0D9488;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;font-size:15px;letter-spacing:0.02em;"
            >
              Verificar mi cuenta
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
