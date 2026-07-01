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
  return [{ filename: "logo_compuestoa.png", path: logoPath, cid: "nodologo" }];
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

const FEEDBACK_CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug",
  idea: "Idea",
  bloat: "Mejora",
};

const FEEDBACK_CATEGORY_COLORS: Record<string, string> = {
  bug: "#DA5A0E",
  idea: "#2563EB",
  bloat: "#059669",
};

const FEEDBACK_NODE_LABELS: Record<string, string> = {
  inmo: "NODO | Inmo",
  autos: "NODO | Autos",
  finanzas: "NODO | Finanzas",
  clinica: "NODO | Clínica",
};

type FeedbackPayload = {
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
}: FeedbackPayload): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error(
      "SMTP no configurado: faltan ZOHO_SMTP_USER y/o ZOHO_SMTP_PASSWORD."
    );
  }

  const to = process.env.FEEDBACK_TO ?? "nodocore.lp@gmail.com";
  const categoryLabel = FEEDBACK_CATEGORY_LABELS[category] ?? category;
  const accentColor = FEEDBACK_CATEGORY_COLORS[category] ?? "#DA5A0E";
  const nodeLabel = FEEDBACK_NODE_LABELS[sourceNode] ?? `NODO | ${sourceNode}`;
  const escaped = content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");

  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
  });

  await transporter.sendMail({
    from: `"NODO Core · Feedback" <${USER}>`,
    to,
    replyTo: userEmail,
    subject: `[${categoryLabel}] Feedback desde ${nodeLabel}`,
    text: [
      `Categoría: ${categoryLabel}`,
      `Nodo: ${nodeLabel}`,
      userEmail ? `Usuario: ${userEmail}` : "",
      "",
      "Mensaje:",
      content,
    ]
      .filter(Boolean)
      .join("\n"),
    attachments: [
      {
        filename: "logo_compuestoa.png",
        path: path.join(process.cwd(), "public/logos/logo compuestoa.png"),
        cid: "nodologo",
      },
    ],
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;border:1px solid #DEE7F1;padding:24px;border-radius:14px;background-color:#F5F8FC;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="cid:nodologo" alt="NODO Core" style="height:32px;display:inline-block;"/>
        </div>
        <h2 style="color:${accentColor};margin-top:0;font-size:20px;text-align:center;">${categoryLabel}</h2>
        <p style="color:#647890;font-size:13px;text-align:center;margin-top:-12px;margin-bottom:20px;">${nodeLabel}</p>
        <div style="background:#ffffff;border:1px solid #DEE7F1;border-radius:10px;padding:16px 20px;">
          <p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0;white-space:pre-wrap;">${escaped}</p>
        </div>
        ${userEmail ? `<p style="color:#9DACBE;font-size:12px;margin-top:16px;margin-bottom:0;">Enviado por: <a href="mailto:${userEmail}" style="color:#DA5A0E;">${userEmail}</a></p>` : ""}
      </div>
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
    subject: `Verificá tu registro en NODO | Clínica Virtual`,
    text: `Hola ${nombre},\n\nGracias por registrarte en NODO | Clínica Virtual (${plan.toUpperCase()}). Para completar tu registro, por favor verifica tu cuenta haciendo clic en el siguiente enlace:\n\n${verificationUrl}\n\nSi no realizaste esta solicitud, podés ignorar este correo.\n\nSaludos,\nEl equipo de NODO Core`,
    attachments: registrationLogoAttachments(),
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;border:1px solid #DEE7F1;padding:24px;border-radius:14px;background-color:#F5F8FC;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="cid:nodologo" alt="NODO Core" style="height:32px;display:inline-block;"/>
        </div>
        <h2 style="color:#1B2A41;margin-top:0;font-size:20px;text-align:center;">Verificá tu registro</h2>
        <p style="color:#647890;font-size:15px;line-height:1.5;">
          Hola <strong>${nombre}</strong>,<br/><br/>
          Completá tu solicitud de registro para el plan <strong>${plan.toUpperCase()}</strong> de <strong>NODO | Clínica Virtual</strong> haciendo clic en el botón de abajo:
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
    subject: `Activá tu cuenta en NODO | Clínica Virtual`,
    text: `Hola ${nombre},\n\nGracias por registrarte como paciente en NODO | Clínica Virtual. Para activar tu cuenta y acceder a las videoconsultas y turnos, hacé clic en el siguiente enlace:\n\n${verificationUrl}\n\nSi no realizaste esta solicitud, podés ignorar este correo.\n\nSaludos,\nEl equipo de NODO Clínica Virtual`,
    attachments: [
      {
        filename: "logo_compuestoa.png",
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
          Activá tu cuenta de paciente de <strong>NODO | Clínica Virtual</strong> haciendo clic en el botón de abajo:
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
}: {
  email: string;
  recoveryUrl: string;
  nodeLabel: string;
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
    from: `"${nodeLabel}" <${USER}>`,
    to: email,
    subject: `Recuperá tu cuenta en ${nodeLabel}`,
    text: `Hola,\n\nRecibimos una solicitud para restablecer la contraseña de tu cuenta en ${nodeLabel}. Hacé clic en el siguiente enlace para crear una nueva contraseña:\n\n${recoveryUrl}\n\nSi no realizaste esta solicitud, podés ignorar este correo.\n\nSaludos,\nEl equipo de ${nodeLabel}`,
    attachments: registrationLogoAttachments(),
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;border:1px solid #DEE7F1;padding:24px;border-radius:14px;background-color:#F5F8FC;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="cid:nodologo" alt="NODO Core" style="height:32px;display:inline-block;"/>
        </div>
        <h2 style="color:#DA5A0E;margin-top:0;font-size:20px;text-align:center;">Recuperá tu cuenta</h2>
        <p style="color:#647890;font-size:15px;line-height:1.5;">
          Hola,<br/><br/>
          Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>${nodeLabel}</strong>. Hacé clic en el botón de abajo para restablecerla:
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${recoveryUrl}" style="background-color:#DA5A0E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
            Restablecer Contraseña
          </a>
        </div>
        <p style="color:#9DACBE;font-size:12px;line-height:1.4;">
          Si el botón no funciona, podés copiar y pegar este enlace en tu navegador:<br/>
          <a href="${recoveryUrl}" style="color:#DA5A0E;">${recoveryUrl}</a>
        </p>
      </div>
    `,
  });
}

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
  nodeLabel: string;
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

  const subject = inviterName
    ? `${inviterName} te invitó a unirse a ${orgName} en ${nodeLabel}`
    : `Invitación al equipo de ${orgName} en ${nodeLabel}`;

  const bodyIntro = inviterName
    ? `<strong>${inviterName}</strong> te invitó a unirte al equipo de <strong>${orgName}</strong>.`
    : `Fuiste invitado a unirte al equipo de <strong>${orgName}</strong>.`;

  await transporter.sendMail({
    from: `"${nodeLabel}" <${USER}>`,
    to: email,
    subject,
    text: `Hola ${name},\n\n${inviterName ? `${inviterName} te` : "Te"} invitó a unirte al equipo de ${orgName} en ${nodeLabel}. Hacé clic en el siguiente enlace para aceptar la invitación:\n\n${inviteUrl}\n\nSi no esperabas esta invitación, podés ignorar este correo.\n\nSaludos,\nEl equipo de ${nodeLabel}`,
    attachments: [
      {
        filename: "logo_compuestoa.png",
        path: path.join(process.cwd(), "public/logos/logo compuestoa.png"),
        cid: "nodologo",
      },
    ],
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;border:1px solid #DEE7F1;padding:24px;border-radius:14px;background-color:#F5F8FC;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="cid:nodologo" alt="NODO Core" style="height:32px;display:inline-block;"/>
        </div>
        <h2 style="color:#DA5A0E;margin-top:0;font-size:20px;text-align:center;">Te invitaron a ${nodeLabel}</h2>
        <p style="color:#647890;font-size:15px;line-height:1.5;">
          Hola <strong>${name}</strong>,<br/><br/>
          ${bodyIntro} Hacé clic en el botón para continuar:
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${inviteUrl}" style="background-color:#DA5A0E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
            Aceptar invitación
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

// Backwards-compatible wrapper — kept so existing callers don't break.
export async function sendInmoStaffInviteEmail(args: {
  name: string;
  email: string;
  inviteUrl: string;
  orgName: string;
  inviterName?: string;
}): Promise<void> {
  return sendStaffInviteEmail({ ...args, nodeLabel: "NODO | Inmo" });
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
  nodeLabel: string;
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

  const subject = inviterName
    ? `${inviterName} te agregó al equipo de ${orgName} en ${nodeLabel}`
    : `Te agregaron al equipo de ${orgName} en ${nodeLabel}`;

  const bodyIntro = inviterName
    ? `<strong>${inviterName}</strong> te agregó al equipo de <strong>${orgName}</strong> en ${nodeLabel}.`
    : `Te agregaron al equipo de <strong>${orgName}</strong> en ${nodeLabel}.`;

  await transporter.sendMail({
    from: `"${nodeLabel}" <${USER}>`,
    to: email,
    subject,
    text: `Hola ${name},\n\n${inviterName ? `${inviterName} te agregó` : "Te agregaron"} al equipo de ${orgName} en ${nodeLabel}. Ya podés ingresar con tu email y contraseña habituales:\n\n${loginUrl}\n\nSaludos,\nEl equipo de ${nodeLabel}`,
    attachments: [
      {
        filename: "logo_compuestoa.png",
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
          ${bodyIntro} Ingresá con tu email y contraseña habituales:
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${loginUrl}" style="background-color:#DA5A0E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
            Ingresar a ${nodeLabel}
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

// Backwards-compatible wrapper — kept so existing callers don't break.
export async function sendInmoStaffAddedEmail(args: {
  name: string;
  email: string;
  orgName: string;
  loginUrl: string;
  inviterName?: string;
}): Promise<void> {
  return sendStaffAddedEmail({ ...args, nodeLabel: "NODO | Inmo" });
}

export async function sendAutosVerificationEmail({
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
  const nodeLabel = "NODO | Autos";
  const brandColor = "#D12D3C";

  await transporter.sendMail({
    from: `"NODO Autos" <${USER}>`,
    to: email,
    subject: `Verificá tu registro en ${nodeLabel}`,
    text: `Hola ${nombre},\n\nGracias por registrarte en ${nodeLabel}. Para activar tu cuenta de concesionaria y acceder al panel de gestión, hacé clic en el siguiente enlace:\n\n${verificationUrl}\n\nSi no realizaste esta solicitud, podés ignorar este correo.\n\nSaludos,\nEl equipo de NODO Autos`,
    attachments: registrationLogoAttachments(),
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;border:1px solid #DEE7F1;padding:24px;border-radius:14px;background-color:#F5F8FC;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="cid:nodologo" alt="NODO Autos" style="height:32px;display:inline-block;"/>
        </div>
        <h2 style="color:#1B2A41;margin-top:0;font-size:20px;text-align:center;">Verificá tu registro</h2>
        <p style="color:#647890;font-size:15px;line-height:1.5;">
          Hola <strong>${nombre}</strong>,<br/><br/>
          Completá tu solicitud de registro en <strong>${nodeLabel}</strong> haciendo clic en el botón de abajo:
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${verificationUrl}" style="background-color:${brandColor};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
            Verificar mi cuenta
          </a>
        </div>
        <p style="color:#9DACBE;font-size:12px;line-height:1.4;">
          Si el botón no funciona, podés copiar y pegar este enlace en tu navegador:<br/>
          <a href="${verificationUrl}" style="color:${brandColor};">${verificationUrl}</a>
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
    from: `"NODO | Inmo" <${USER}>`,
    to: email,
    subject: `Activá tu cuenta en NODO | Inmo`,
    text: `Hola ${nombre},\n\nGracias por registrarte en NODO | Inmo. Para activar tu cuenta de inmobiliaria y acceder al panel de gestión, hacé clic en el siguiente enlace:\n\n${verificationUrl}\n\nSi no realizaste esta solicitud, podés ignorar este correo.\n\nSaludos,\nEl equipo de NODO | Inmo`,
    attachments: [
      {
        filename: "logo_compuestoa.png",
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
}: {
  nombre: string;
  email: string;
  nodeLabel: string;
  loginUrl: string;
}): Promise<void> {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"NODO Core · Activación" <${USER}>`,
    to: email,
    subject: `Tu acceso a ${nodeLabel} fue habilitado`,
    text: `Hola ${nombre},\n\nTu cuenta en ${nodeLabel} fue habilitada. Configurá tu contraseña en el primer acceso:\n\n${loginUrl}\n\nSaludos,\nNODO Core`,
    attachments: registrationLogoAttachments(),
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;border:1px solid #DEE7F1;padding:24px;border-radius:14px;background:#F5F8FC;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="cid:nodologo" alt="NODO Core" style="height:32px;display:inline-block;"/>
        </div>
        <h2 style="color:#DA5A0E;margin-top:0;font-size:20px;text-align:center;">¡Tu cuenta fue habilitada!</h2>
        <p style="color:#647890;font-size:15px;line-height:1.5;">
          Hola <strong>${nombre}</strong>, tu acceso a <strong>${nodeLabel}</strong> está listo.
        </p>
        <p style="color:#647890;font-size:15px;line-height:1.5;">Configurá tu contraseña en el primer acceso:</p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${loginUrl}" style="display:inline-block;background:#DA5A0E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
            Configurar contraseña e ingresar
          </a>
        </div>
      </div>
    `,
  });
}

export async function sendClientNodoInviteEmail({
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
    from: `"NODO Core · Invitación" <${USER}>`,
    to: email,
    subject: `Te invitaron a ${nodeLabel} — activá tu cuenta`,
    text: `Hola ${nombre},\n\nTe invitaron a usar ${nodeLabel}. Completá tu registro y elegí tu contraseña con este enlace:\n\n${activationUrl}\n\nEl enlace expira en 72 horas.\n\nSaludos,\nNODO Core`,
    attachments: [
      {
        filename: "logo_compuestoa.png",
        path: path.join(process.cwd(), "public/logos/logo compuestoa.png"),
        cid: "nodologo",
      },
    ],
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;border:1px solid #DEE7F1;padding:24px;border-radius:14px;background:#F5F8FC;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="cid:nodologo" alt="NODO Core" style="height:32px;display:inline-block;"/>
        </div>
        <h2 style="color:#DA5A0E;margin-top:0;font-size:20px;text-align:center;">Te invitaron a ${nodeLabel}</h2>
        <p style="color:#647890;font-size:15px;line-height:1.5;">
          Hola <strong>${nombre}</strong>,<br/><br/>
          Desde NODO Core te dieron acceso a <strong>${nodeLabel}</strong>. Completá tu perfil y definí tu contraseña para empezar:
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${activationUrl}" style="background-color:#DA5A0E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
            Activar mi cuenta
          </a>
        </div>
        <p style="color:#9DACBE;font-size:12px;">Este enlace expira en 72 horas.</p>
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
        filename: "logo_compuestoa.png",
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
