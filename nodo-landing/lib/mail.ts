import "server-only";
import fs from "fs";
import nodemailer from "nodemailer";
import path from "path";

// Zoho SMTP transport. Credentials live in env vars so they never ship to the
// client. Host/port default to Zoho's standard SSL endpoint.
const HOST = process.env.ZOHO_SMTP_HOST ?? "smtp.zoho.com";
const PORT = Number(process.env.ZOHO_SMTP_PORT ?? 465);
const USER = process.env.ZOHO_SMTP_USER;
const PASS = process.env.ZOHO_SMTP_PASSWORD;
const CONTACT_TO = process.env.CONTACT_TO ?? "contacto@nodocore.com.ar";

export function isMailConfigured(): boolean {
  return Boolean(USER && PASS);
}

function registrationLogoAttachments(): nodemailer.SendMailOptions["attachments"] {
  const logoPath = path.join(process.cwd(), "public/logos/logo compuestoa.png");
  if (!fs.existsSync(logoPath)) return [];
  return [{ filename: "logo_compuesto.png", path: logoPath, cid: "nodologo" }];
}

type ContactPayload = {
  nombre: string;
  email: string;
  mensaje: string;
};

export async function sendContactEmail({
  nombre,
  email,
  mensaje,
}: ContactPayload): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error(
      "SMTP no configurado: faltan ZOHO_SMTP_USER y/o ZOHO_SMTP_PASSWORD."
    );
  }

  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user: USER, pass: PASS },
  });

  const escaped = mensaje.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  await transporter.sendMail({
    // Must be the authenticated Zoho mailbox (or one of its aliases).
    from: `"NODO Core · Web" <${USER}>`,
    to: CONTACT_TO,
    replyTo: email, // reply goes straight to the visitor
    subject: `Nuevo contacto web: ${nombre}`,
    text: `Nombre: ${nombre}\nEmail: ${email}\n\nMensaje:\n${mensaje}`,
    html: `
      <h2 style="font-family:sans-serif;margin:0 0 12px">Nuevo contacto desde la web</h2>
      <p style="font-family:sans-serif;margin:0 0 6px"><strong>Nombre:</strong> ${nombre}</p>
      <p style="font-family:sans-serif;margin:0 0 6px"><strong>Email:</strong> ${email}</p>
      <p style="font-family:sans-serif;margin:12px 0 4px"><strong>Mensaje:</strong></p>
      <p style="font-family:sans-serif;white-space:pre-wrap;margin:0">${escaped}</p>
    `,
  });
}

export async function sendRegistrationVerificationEmail({
  nombre,
  email,
  plan,
  token,
  origin,
}: {
  nombre: string;
  email: string;
  plan: string;
  token: string;
  origin: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error(
      "SMTP no configurado: faltan ZOHO_SMTP_USER y/o ZOHO_SMTP_PASSWORD."
    );
  }

  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
  });

  const verificationUrl = `${origin}/api/verify-registration?token=${token}`;

  await transporter.sendMail({
    from: `"NODO Core · Registro" <${USER}>`,
    to: email,
    subject: `Verificá tu registro en NODO | Clínica`,
    text: `Hola ${nombre},\n\nGracias por registrarte en NODO | Clínica (${plan.toUpperCase()}). Para completar tu registro, por favor verifica tu cuenta haciendo clic en el siguiente enlace:\n\n${verificationUrl}\n\nSi no realizaste esta solicitud, podés ignorar este correo.\n\nSaludos,\nEl equipo de NODO Core`,
    attachments: registrationLogoAttachments(),
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;border:1px solid #DEE7F1;padding:24px;border-radius:14px;background-color:#F5F8FC;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="cid:nodologo" alt="NODO Core" style="height:32px;display:inline-block;"/>
        </div>
        <h2 style="color:#1B2A41;margin-top:0;font-size:20px;text-align:center;">Verificá tu registro</h2>
        <p style="color:#647890;font-size:15px;line-height:1.5;">
          Hola <strong>${nombre}</strong>,<br/><br/>
          Completá tu solicitud de registro para el plan <strong>${plan.toUpperCase()}</strong> de <strong>NODO | Clínica</strong> haciendo clic en el botón de abajo:
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${verificationUrl}" style="background-color:#DA5A0E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
            Verificar mi Cuenta
          </a>
        </div>
        <p style="color:#9DACBE;font-size:12px;line-height:1.4;">
          Si el botón no funciona, podés copiar y pegar este enlace en tu navegador:<br/>
          <a href="${verificationUrl}" style="color:#DA5A0E;">${verificationUrl}</a>
        </p>
      </div>
    `,
  });
}

export async function sendFinanzasVerificationEmail({
  nombre,
  email,
  token,
  origin,
}: {
  nombre: string;
  email: string;
  token: string;
  origin: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error(
      "SMTP no configurado: faltan ZOHO_SMTP_USER y/o ZOHO_SMTP_PASSWORD.",
    );
  }

  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
  });

  const verificationUrl = `${origin}/api/verify-registration?token=${token}`;
  const attachments = registrationLogoAttachments();
  const logoHtml = attachments?.length
    ? `<div style="text-align:center;margin-bottom:20px;"><img src="cid:nodologo" alt="NODO Finanzas" style="height:32px;display:inline-block;"/></div>`
    : "";

  await transporter.sendMail({
    from: `"NODO Finanzas Personales" <${USER}>`,
    to: email,
    subject: "Verificá tu cuenta en NODO Finanzas Personales",
    text: `Hola ${nombre},\n\nGracias por registrarte en NODO Finanzas Personales. Para activar tu cuenta, verificá tu correo con este enlace:\n\n${verificationUrl}\n\nEl enlace vence en 24 horas.\n\nSaludos,\nEl equipo de NODO Core`,
    attachments,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;border:1px solid #DEE7F1;padding:24px;border-radius:14px;background-color:#F5F8FC;">
        ${logoHtml}
        <h2 style="color:#1B2A41;margin-top:0;font-size:20px;text-align:center;">Verificá tu cuenta</h2>
        <p style="color:#647890;font-size:15px;line-height:1.5;">
          Hola <strong>${nombre}</strong>,<br/><br/>
          Confirmá tu correo para empezar a usar <strong>NODO Finanzas Personales</strong>:
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${verificationUrl}" style="background-color:#DA5A0E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
            Verificar mi cuenta
          </a>
        </div>
        <p style="color:#9DACBE;font-size:12px;line-height:1.4;">
          Si el botón no funciona, copiá este enlace en tu navegador:<br/>
          <a href="${verificationUrl}" style="color:#DA5A0E;">${verificationUrl}</a>
        </p>
      </div>
    `,
  });
}

export async function sendPatientVerificationEmail({
  nombre,
  email,
  token,
  origin,
}: {
  nombre: string;
  email: string;
  token: string;
  origin: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error(
      "SMTP no configurado: faltan ZOHO_SMTP_USER y/o ZOHO_SMTP_PASSWORD."
    );
  }

  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
  });

  const verificationUrl = `${origin}/api/verify-registration?token=${token}`;

  await transporter.sendMail({
    from: `"NODO Clínica Virtual" <${USER}>`,
    to: email,
    subject: `Activá tu cuenta en NODO | Clínica`,
    text: `Hola ${nombre},\n\nGracias por registrarte como paciente en NODO | Clínica. Para activar tu cuenta y acceder a las videoconsultas y turnos, hacé clic en el siguiente enlace:\n\n${verificationUrl}\n\nSi no realizaste esta solicitud, podés ignorar este correo.\n\nSaludos,\nEl equipo de NODO Clínica Virtual`,
    attachments: [
      {
        filename: "logo_compuesto.png",
        path: path.join(process.cwd(), "public/logos/logo compuestoa.png"),
        cid: "nodologo",
      },
    ],
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;border:1px solid #DEE7F1;padding:24px;border-radius:14px;background-color:#F5F8FC;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="cid:nodologo" alt="NODO Core" style="height:32px;display:inline-block;"/>
        </div>
        <h2 style="color:#DA5A0E;margin-top:0;font-size:20px;text-align:center;">Activá tu cuenta</h2>
        <p style="color:#647890;font-size:15px;line-height:1.5;">
          Hola <strong>${nombre}</strong>,<br/><br/>
          Activá tu cuenta de paciente de <strong>NODO | Clínica</strong> haciendo clic en el botón de abajo:
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${verificationUrl}" style="background-color:#DA5A0E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
            Activar mi Cuenta
          </a>
        </div>
        <p style="color:#9DACBE;font-size:12px;line-height:1.4;">
          Si el botón no funciona, podés copiar y pegar este enlace en tu navegador:<br/>
          <a href="${verificationUrl}" style="color:#DA5A0E;">${verificationUrl}</a>
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail({
  email,
  recoveryUrl,
  nodeLabel,
  nodeSlug = "",
}: {
  email: string;
  recoveryUrl: string;
  nodeLabel: string;
  nodeSlug?: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error(
      "SMTP no configurado: faltan ZOHO_SMTP_USER y/o ZOHO_SMTP_PASSWORD."
    );
  }

  // Per-node brand colors — matches getNodeAccentBySlug logic without importing it.
  const slug = nodeSlug.trim().toLowerCase().replace(/^nodo-/, "");
  const brandMap: Record<string, { brand: string; light: boolean }> = {
    finanzas:  { brand: "#43936C", light: false },
    clinica:   { brand: "#0D9488", light: false },
    salud:     { brand: "#0D9488", light: false },
    autos:     { brand: "#D12D3C", light: false },
    automotores: { brand: "#D12D3C", light: false },
    obra:      { brand: "#CA8A04", light: false },
    contable:  { brand: "#7C3AED", light: false },
    ecommerce: { brand: "#FFF600", light: true  },
  };
  const theme = brandMap[slug] ?? { brand: "#DA5A0E", light: false };
  const brandColor   = theme.brand;
  const buttonText   = theme.light ? "#000000" : "#ffffff";
  const badgeBg      = theme.light ? "#000000" : "rgba(0,0,0,0.20)";
  const badgeText    = theme.light ? brandColor : "#ffffff";
  const linkColor    = theme.light ? "#857f00" : brandColor;

  const attachments = registrationLogoAttachments();
  const logoHtml = attachments?.length
    ? `<img src="cid:nodologo" alt="NODO Core" style="height:28px;display:inline-block;margin-bottom:16px;"/><br/>`
    : "";

  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
  });

  await transporter.sendMail({
    from: `"${nodeLabel}" <${USER}>`,
    to: email,
    subject: `Restablecé tu cuenta en ${nodeLabel}`,
    text: `Hola,\n\nRecibimos una solicitud para restablecer tu cuenta en ${nodeLabel}. Hacé clic en el siguiente enlace para configurar tu contraseña e ingresar:\n\n${recoveryUrl}\n\nSi no realizaste esta solicitud, podés ignorar este correo.\n\nSaludos,\nEl equipo de NODO Core`,
    attachments,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">

        <!-- Header: logo + brand strip -->
        <div style="background-color:${brandColor};padding:28px 32px 24px;text-align:center;">
          ${logoHtml}
          <span style="display:inline-block;background:${badgeBg};color:${badgeText};font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:4px 12px;border-radius:100px;">
            ◎ ${nodeLabel}
          </span>
        </div>

        <!-- Body -->
        <div style="background:#ffffff;padding:32px;">
          <h2 style="color:#0a0a0a;margin:0 0 8px;font-size:22px;font-weight:800;text-align:center;">
            Restablecé tu cuenta
          </h2>
          <p style="color:#374151;font-size:15px;line-height:1.6;text-align:center;margin:0 0 8px;">
            en <strong>${nodeLabel}</strong>
          </p>
          <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;"/>
          <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Recibimos una solicitud para restablecer el acceso a tu cuenta.<br/>
            Hacé clic en el botón de abajo para configurar tu contraseña e ingresar:
          </p>

          <!-- CTA -->
          <div style="text-align:center;margin:0 0 28px;">
            <a href="${recoveryUrl}"
               style="background-color:${brandColor};color:${buttonText};padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:800;display:inline-block;font-size:15px;letter-spacing:.01em;">
              Restablecer cuenta
            </a>
          </div>

          <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:0;">
            Si el botón no funciona, copiá este enlace en tu navegador:<br/>
            <a href="${recoveryUrl}" style="color:${linkColor};word-break:break-all;">${recoveryUrl}</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:16px 32px;text-align:center;">
          <p style="color:#9ca3af;font-size:11px;margin:0;">
            Si no realizaste esta solicitud, podés ignorar este correo.
          </p>
          <p style="color:#d1d5db;font-size:11px;margin:6px 0 0;">
            © 2026 NODO Core · nodocore.com.ar
          </p>
        </div>

      </div>
    `,
  });
}

export async function sendInmoStaffInviteEmail({
  name,
  email,
  inviteUrl,
  orgName,
}: {
  name: string;
  email: string;
  inviteUrl: string;
  orgName: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error(
      "SMTP no configurado: faltan ZOHO_SMTP_USER y/o ZOHO_SMTP_PASSWORD."
    );
  }

  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
  });

  await transporter.sendMail({
    from: `"NODO Inmo" <${USER}>`,
    to: email,
    subject: `Invitación al equipo de ${orgName} en NODO | Inmo`,
    text: `Hola ${name},\n\nTe invitaron a unirte al equipo de ${orgName} en NODO | Inmo. Para activar tu cuenta, elegí tu contraseña en el siguiente enlace:\n\n${inviteUrl}\n\nSi no esperabas esta invitación, podés ignorar este correo.\n\nSaludos,\nEl equipo de NODO Inmo`,
    attachments: [
      {
        filename: "logo_compuesto.png",
        path: path.join(process.cwd(), "public/logos/logo compuestoa.png"),
        cid: "nodologo",
      },
    ],
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;border:1px solid #DEE7F1;padding:24px;border-radius:14px;background-color:#F5F8FC;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="cid:nodologo" alt="NODO Core" style="height:32px;display:inline-block;"/>
        </div>
        <h2 style="color:#DA5A0E;margin-top:0;font-size:20px;text-align:center;">Te invitaron a NODO | Inmo</h2>
        <p style="color:#647890;font-size:15px;line-height:1.5;">
          Hola <strong>${name}</strong>,<br/><br/>
          Te sumaron al equipo de <strong>${orgName}</strong>. Activá tu acceso y elegí tu contraseña:
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${inviteUrl}" style="background-color:#DA5A0E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
            Activar mi cuenta
          </a>
        </div>
        <p style="color:#9DACBE;font-size:12px;line-height:1.4;">
          Si el botón no funciona, copiá este enlace en tu navegador:<br/>
          <a href="${inviteUrl}" style="color:#DA5A0E;">${inviteUrl}</a>
        </p>
      </div>
    `,
  });
}

export async function sendInmoStaffAddedEmail({
  name,
  email,
  orgName,
  loginUrl,
}: {
  name: string;
  email: string;
  orgName: string;
  loginUrl: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error(
      "SMTP no configurado: faltan ZOHO_SMTP_USER y/o ZOHO_SMTP_PASSWORD."
    );
  }

  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
  });

  await transporter.sendMail({
    from: `"NODO Inmo" <${USER}>`,
    to: email,
    subject: `Te agregaron al equipo de ${orgName} en NODO | Inmo`,
    text: `Hola ${name},\n\nTe agregaron al equipo de ${orgName} en NODO | Inmo. Ya podés ingresar con tu email y contraseña habituales:\n\n${loginUrl}\n\nSaludos,\nEl equipo de NODO Inmo`,
    attachments: [
      {
        filename: "logo_compuesto.png",
        path: path.join(process.cwd(), "public/logos/logo compuestoa.png"),
        cid: "nodologo",
      },
    ],
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;border:1px solid #DEE7F1;padding:24px;border-radius:14px;background-color:#F5F8FC;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="cid:nodologo" alt="NODO Core" style="height:32px;display:inline-block;"/>
        </div>
        <h2 style="color:#DA5A0E;margin-top:0;font-size:20px;text-align:center;">Acceso habilitado</h2>
        <p style="color:#647890;font-size:15px;line-height:1.5;">
          Hola <strong>${name}</strong>,<br/><br/>
          Te agregaron al equipo de <strong>${orgName}</strong> en NODO | Inmo. Ingresá con tu email y contraseña habituales:
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${loginUrl}" style="background-color:#DA5A0E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
            Ingresar a NODO Inmo
          </a>
        </div>
        <p style="color:#9DACBE;font-size:12px;line-height:1.4;">
          Si el botón no funciona, copiá este enlace en tu navegador:<br/>
          <a href="${loginUrl}" style="color:#DA5A0E;">${loginUrl}</a>
        </p>
      </div>
    `,
  });
}

export async function sendInmoVerificationEmail({
  nombre,
  email,
  token,
  origin,
}: {
  nombre: string;
  email: string;
  token: string;
  origin: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error(
      "SMTP no configurado: faltan ZOHO_SMTP_USER y/o ZOHO_SMTP_PASSWORD."
    );
  }

  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
  });

  const verificationUrl = `${origin}/api/verify-registration?token=${token}`;

  await transporter.sendMail({
    from: `"NODO Inmo" <${USER}>`,
    to: email,
    subject: `Activá tu cuenta en NODO | Inmo`,
    text: `Hola ${nombre},\n\nGracias por registrarte en NODO | Inmo. Para activar tu cuenta de inmobiliaria y acceder al panel de gestión, hacé clic en el siguiente enlace:\n\n${verificationUrl}\n\nSi no realizaste esta solicitud, podés ignorar este correo.\n\nSaludos,\nEl equipo de NODO Inmo`,
    attachments: [
      {
        filename: "logo_compuesto.png",
        path: path.join(process.cwd(), "public/logos/logo compuestoa.png"),
        cid: "nodologo",
      },
    ],
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;border:1px solid #DEE7F1;padding:24px;border-radius:14px;background-color:#F5F8FC;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="cid:nodologo" alt="NODO Core" style="height:32px;display:inline-block;"/>
        </div>
        <h2 style="color:#DA5A0E;margin-top:0;font-size:20px;text-align:center;">Activá tu cuenta</h2>
        <p style="color:#647890;font-size:15px;line-height:1.5;">
          Hola <strong>${nombre}</strong>,<br/><br/>
          Activá tu cuenta de <strong>NODO | Inmo</strong> haciendo clic en el botón de abajo:
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${verificationUrl}" style="background-color:#DA5A0E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
            Activar mi Cuenta
          </a>
        </div>
        <p style="color:#9DACBE;font-size:12px;line-height:1.4;">
          Si el botón no funciona, podés copiar y pegar este enlace en tu navegador:<br/>
          <a href="${verificationUrl}" style="color:#DA5A0E;">${verificationUrl}</a>
        </p>
      </div>
    `,
  });
}

export async function sendEcommerceVerificationEmail({
  nombre,
  email,
  token,
  origin,
}: {
  nombre: string;
  email: string;
  token: string;
  origin: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error("SMTP no configurado: faltan ZOHO_SMTP_USER y/o ZOHO_SMTP_PASSWORD.");
  }

  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
  });

  const verificationUrl = `${origin}/api/verify-registration?token=${token}`;
  const attachments = registrationLogoAttachments();

  await transporter.sendMail({
    from: `"NODO Ecommerce" <${USER}>`,
    to: email,
    subject: `Activá tu cuenta en NODO | Ecommerce`,
    text: `Hola ${nombre},\n\nGracias por registrarte en NODO | Ecommerce. Para activar tu cuenta y empezar a gestionar tu tienda, hacé clic en el siguiente enlace:\n\n${verificationUrl}\n\nEl enlace vence en 24 horas.\n\nSaludos,\nEl equipo de NODO Core`,
    attachments,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">

        <!-- Header amarillo -->
        <div style="background-color:#FFF600;padding:28px 32px 24px;text-align:center;">
          ${attachments?.length
            ? `<img src="cid:nodologo" alt="NODO Core" style="height:28px;display:inline-block;margin-bottom:16px;"/><br/>`
            : ""}
          <span style="display:inline-block;background:#000;color:#FFF600;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:4px 12px;border-radius:100px;">
            ◎ Nodo Ecommerce
          </span>
        </div>

        <!-- Body -->
        <div style="background:#ffffff;padding:32px;">
          <h2 style="color:#0a0a0a;margin:0 0 8px;font-size:22px;font-weight:800;text-align:center;">
            ¡Gracias por registrarte!
          </h2>
          <p style="color:#374151;font-size:15px;line-height:1.6;text-align:center;margin:0 0 8px;">
            en <strong>NODO | Ecommerce</strong>
          </p>
          <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;"/>
          <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Hola <strong>${nombre}</strong>,<br/><br/>
            Confirmá tu correo para activar tu cuenta y empezar a cargar productos, configurar tu tienda y recibir pedidos.
          </p>

          <!-- CTA -->
          <div style="text-align:center;margin:0 0 28px;">
            <a href="${verificationUrl}"
               style="background-color:#FFF600;color:#000000;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:800;display:inline-block;font-size:15px;letter-spacing:.01em;">
              Activar mi cuenta
            </a>
          </div>

          <!-- Features row -->
          <div style="display:flex;gap:12px;margin-bottom:28px;">
            <div style="flex:1;background:#fafafa;border:1px solid #f3f4f6;border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:12px;font-weight:700;color:#111;">Catálogo</div>
              <div style="font-size:11px;color:#6b7280;margin-top:2px;">Productos y stock</div>
            </div>
            <div style="flex:1;background:#fafafa;border:1px solid #f3f4f6;border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:12px;font-weight:700;color:#111;">Pedidos</div>
              <div style="font-size:11px;color:#6b7280;margin-top:2px;">Gestión completa</div>
            </div>
            <div style="flex:1;background:#fafafa;border:1px solid #f3f4f6;border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:12px;font-weight:700;color:#111;">Pagos</div>
              <div style="font-size:11px;color:#6b7280;margin-top:2px;">MercadoPago y más</div>
            </div>
          </div>

          <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:0;">
            Si el botón no funciona, copiá este enlace en tu navegador:<br/>
            <a href="${verificationUrl}" style="color:#b8a000;word-break:break-all;">${verificationUrl}</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:16px 32px;text-align:center;">
          <p style="color:#9ca3af;font-size:11px;margin:0;">
            Este enlace vence en 24 horas · Si no te registraste, ignorá este correo.
          </p>
          <p style="color:#d1d5db;font-size:11px;margin:6px 0 0;">
            © 2026 NODO Core · nodocore.com.ar
          </p>
        </div>

      </div>
    `,
  });
}

function createTransporter() {
  if (!isMailConfigured()) {
    throw new Error("SMTP no configurado.");
  }
  return nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
  });
}

export async function sendAdminNewRegistrationEmail({
  clientName,
  email,
  unitCode,
  plan,
  origin,
}: {
  clientName: string;
  email: string;
  unitCode: string;
  plan: string;
  origin: string;
}): Promise<void> {
  const transporter = createTransporter();
  const panelUrl = `${origin}/panel/solicitudes`;

  await transporter.sendMail({
    from: `"NODO Core · Registros" <${USER}>`,
    to: CONTACT_TO,
    subject: `Nueva solicitud de registro — ${unitCode}`,
    text: `Nueva solicitud pendiente de revisión:\n\nNombre: ${clientName}\nEmail: ${email}\nNodo: ${unitCode}\nPlan: ${plan}\n\nRevisar en: ${panelUrl}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #DEE7F1;border-radius:14px;">
        <h2 style="color:#1B2A41;margin-top:0;">Nueva solicitud de registro</h2>
        <p style="color:#647890;line-height:1.5;">
          <strong>Nombre:</strong> ${clientName}<br/>
          <strong>Email:</strong> ${email}<br/>
          <strong>Nodo:</strong> ${unitCode}<br/>
          <strong>Plan:</strong> ${plan}
        </p>
        <a href="${panelUrl}" style="display:inline-block;margin-top:16px;background:#DA5A0E;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
          Revisar en Core Dashboard
        </a>
      </div>
    `,
  });
}

export async function sendAccountEnabledEmail({
  nombre,
  email,
  nodeLabel,
  loginUrl,
  unitCode = "",
}: {
  nombre: string;
  email: string;
  nodeLabel: string;
  loginUrl: string;
  unitCode?: string;
}): Promise<void> {
  const transporter = createTransporter();

  // Per-node brand theme — same logic as sendPasswordResetEmail.
  // Normalize: lowercase + strip diacritics so "Clínica" → "clinica".
  const slug = unitCode.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const brandMap: Record<string, { brand: string; light: boolean }> = {
    finanzas:    { brand: "#43936C", light: false },
    clinica:     { brand: "#0D9488", light: false },
    salud:       { brand: "#0D9488", light: false },
    autos:       { brand: "#D12D3C", light: false },
    automotores: { brand: "#D12D3C", light: false },
    obra:        { brand: "#CA8A04", light: false },
    contable:    { brand: "#7C3AED", light: false },
    ecommerce:   { brand: "#FFF600", light: true  },
  };
  const theme      = brandMap[slug] ?? { brand: "#DA5A0E", light: false };
  const brandColor = theme.brand;
  const buttonText = theme.light ? "#000000" : "#ffffff";
  const linkColor  = theme.light ? "#857f00" : brandColor;

  // Use a public URL for the white logo — avoids CID attachment delays in mail clients.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.nodocore.com.ar").replace(/\/$/, "");
  const logoUrl = `${appUrl}/logos/logo%20compuesto%20estrella%20az%20letra%20blanca_50.png`;
  const logoHtml = `<img src="${logoUrl}" alt="NODO Core" style="height:44px;width:auto;display:inline-block;"/>`;

  await transporter.sendMail({
    from: `"NODO Core · Activación" <${USER}>`,
    to: email,
    subject: `Tu acceso a ${nodeLabel} fue habilitado`,
    text: `Hola ${nombre},\n\nTu acceso a ${nodeLabel} está listo. Configurá tu contraseña en el primer ingreso:\n\n${loginUrl}\n\nSaludos,\nNODO Core`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">

        <!-- Header brandado -->
        <div style="background-color:${brandColor};padding:36px 48px 28px;text-align:center;">
          ${logoHtml}
        </div>

        <!-- Body -->
        <div style="background:#ffffff;padding:32px;">
          <h2 style="color:#0a0a0a;margin:0 0 8px;font-size:22px;font-weight:800;text-align:center;">
            ¡Tu cuenta fue habilitada!
          </h2>
          <p style="color:#374151;font-size:15px;line-height:1.6;text-align:center;margin:0 0 8px;">
            en <strong>${nodeLabel}</strong>
          </p>
          <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;"/>
          <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Hola <strong>${nombre}</strong>,<br/><br/>
            Tu acceso a <strong>${nodeLabel}</strong> está listo. Hacé clic en el botón para configurar tu contraseña e ingresar:
          </p>

          <!-- CTA -->
          <div style="text-align:center;margin:0 0 28px;">
            <a href="${loginUrl}"
               style="background-color:${brandColor};color:${buttonText};padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:800;display:inline-block;font-size:15px;letter-spacing:.01em;">
              Configurar contraseña e ingresar
            </a>
          </div>

          <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:0;">
            Si el botón no funciona, copiá este enlace en tu navegador:<br/>
            <a href="${loginUrl}" style="color:${linkColor};word-break:break-all;">${loginUrl}</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:16px 32px;text-align:center;">
          <p style="color:#9ca3af;font-size:11px;margin:0;">
            Si no esperabas este correo, podés ignorarlo.
          </p>
          <p style="color:#d1d5db;font-size:11px;margin:6px 0 0;">
            © 2026 NODO Core · nodocore.com.ar
          </p>
        </div>

      </div>
    `,
  });
}

export async function sendActivationEmail({
  nombre,
  email,
  nodeLabel,
  activationUrl,
}: {
  nombre: string;
  email: string;
  nodeLabel: string;
  activationUrl: string;
}): Promise<void> {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"NODO Core · Activación" <${USER}>`,
    to: email,
    subject: `Tu acceso a ${nodeLabel} está listo — completá tu registro`,
    text: `Hola ${nombre},\n\nTu solicitud fue aprobada. Completá tu registro en ${nodeLabel} usando este enlace:\n\n${activationUrl}\n\nEl enlace expira en 72 horas.\n\nSaludos,\nNODO Core`,
    attachments: [
      {
        filename: "logo_compuesto.png",
        path: path.join(process.cwd(), "public/logos/logo compuestoa.png"),
        cid: "nodologo",
      },
    ],
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;border:1px solid #DEE7F1;padding:24px;border-radius:14px;background:#F5F8FC;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="cid:nodologo" alt="NODO Core" style="height:32px;display:inline-block;"/>
        </div>
        <h2 style="color:#DA5A0E;margin-top:0;font-size:20px;text-align:center;">¡Tu acceso fue aprobado!</h2>
        <p style="color:#647890;font-size:15px;line-height:1.5;">
          Hola <strong>${nombre}</strong>,<br/><br/>
          Tu solicitud para <strong>${nodeLabel}</strong> fue habilitada. Completá tu perfil y elegí tu plan para empezar:
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${activationUrl}" style="background-color:#DA5A0E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
            Completar registro
          </a>
        </div>
        <p style="color:#9DACBE;font-size:12px;">Este enlace expira en 72 horas.</p>
      </div>
    `,
  });
}

// Backward-compat aliases — routes from main used these names before the merge
export const sendClientNodoInviteEmail = sendActivationEmail;

export async function sendStaffInviteEmail({
  name,
  email,
  inviteUrl,
  orgName,
  inviterName,
  nodeLabel,
}: {
  name: string;
  email: string;
  inviteUrl: string;
  orgName: string;
  inviterName?: string;
  nodeLabel?: string;
}): Promise<void> {
  return sendInmoStaffInviteEmail({ name, email, inviteUrl, orgName });
}

export async function sendStaffAddedEmail({
  name,
  email,
  orgName,
  loginUrl,
  inviterName,
  nodeLabel,
}: {
  name: string;
  email: string;
  orgName: string;
  loginUrl: string;
  inviterName?: string;
  nodeLabel?: string;
}): Promise<void> {
  return sendInmoStaffAddedEmail({ name, email, orgName, loginUrl });
}

type FeedbackEmailPayload = {
  category: "bug" | "idea" | "bloat";
  content: string;
  sourceNode: string;
  userEmail?: string;
};

export async function sendFeedbackEmail({
  category,
  content,
  sourceNode,
  userEmail,
}: FeedbackEmailPayload): Promise<void> {
  const transporter = createTransporter();
  const categoryLabel = category === "bug" ? "🐛 Bug" : category === "idea" ? "💡 Idea" : "🧹 Bloat";

  await transporter.sendMail({
    from: `"NODO Core · Feedback" <${USER}>`,
    to: CONTACT_TO,
    subject: `[Feedback] ${categoryLabel} — ${sourceNode}`,
    text: `Nodo: ${sourceNode}\nCategoría: ${category}\nUsuario: ${userEmail ?? "anónimo"}\n\n${content}`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;border:1px solid #DEE7F1;padding:24px;border-radius:14px;background:#F5F8FC;">
        <h2 style="color:#DA5A0E;margin-top:0;font-size:18px;">${categoryLabel} — ${sourceNode}</h2>
        <p style="color:#647890;font-size:13px;margin:0 0 8px;">Usuario: <strong>${userEmail ?? "anónimo"}</strong></p>
        <p style="color:#1A2B3C;font-size:15px;line-height:1.6;white-space:pre-wrap;">${content}</p>
      </div>
    `,
  });
}
