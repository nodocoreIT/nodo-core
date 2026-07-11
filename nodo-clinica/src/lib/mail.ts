import "server-only";
import nodemailer from "nodemailer";

const HOST = process.env.ZOHO_SMTP_HOST ?? "smtp.zoho.com";
const PORT = Number(process.env.ZOHO_SMTP_PORT ?? 465);
const USER = process.env.ZOHO_SMTP_USER;
const PASS = process.env.ZOHO_SMTP_PASSWORD;

export function isMailConfigured(): boolean {
  return Boolean(USER && PASS);
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

  const { email, role, token, origin } = params;
  const verificationUrl = `${origin}/api/clinic/account/verify?token=${token}&role=${role}`;

  const roleLabel = role === "medico" ? "médico" : "paciente";

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
      ``,
      `Saludos,`,
      `El equipo de Nodo Clínica`,
    ].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;border:1px solid #CCEBE9;padding:32px;border-radius:14px;background-color:#F0FAFA;">
        <h2 style="color:#0D9488;margin-top:0;font-size:22px;text-align:center;">
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
            style="background-color:#0D9488;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;font-size:15px;letter-spacing:0.02em;"
          >
            Verificar mi cuenta
          </a>
        </div>
        <p style="color:#6B7280;font-size:12px;line-height:1.5;">
          El enlace vence en 24 horas. Si el botón no funciona, copiá este
          enlace en tu navegador:<br/>
          <a href="${verificationUrl}" style="color:#0D9488;word-break:break-all;">${verificationUrl}</a>
        </p>
        <hr style="border:none;border-top:1px solid #CCEBE9;margin:20px 0;"/>
        <p style="color:#9CA3AF;font-size:11px;text-align:center;margin:0;">
          Si no realizaste esta solicitud, ignorá este correo.
        </p>
      </div>
    `,
  });
}
