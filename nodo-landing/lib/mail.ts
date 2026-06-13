import "server-only";
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
    subject: `Verificá tu registro en NODO | Clínica Virtual`,
    text: `Hola ${nombre},\n\nGracias por registrarte en NODO | Clínica Virtual (${plan.toUpperCase()}). Para completar tu registro, por favor verifica tu cuenta haciendo clic en el siguiente enlace:\n\n${verificationUrl}\n\nSi no realizaste esta solicitud, podés ignorar este correo.\n\nSaludos,\nEl equipo de NODO Core`,
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
}: {
  email: string;
  recoveryUrl: string;
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
    from: `"NODO Clínica Virtual" <${USER}>`,
    to: email,
    subject: `Recuperá tu cuenta en NODO | Clínica Virtual`,
    text: `Hola,\n\nRecibimos una solicitud para restablecer la contraseña de tu cuenta en NODO | Clínica Virtual. Hacé clic en el siguiente enlace para crear una nueva contraseña:\n\n${recoveryUrl}\n\nSi no realizaste esta solicitud, podés ignorar este correo.\n\nSaludos,\nEl equipo de NODO Clínica Virtual`,
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
        <h2 style="color:#DA5A0E;margin-top:0;font-size:20px;text-align:center;">Recuperá tu cuenta</h2>
        <p style="color:#647890;font-size:15px;line-height:1.5;">
          Hola,<br/><br/>
          Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>NODO | Clínica Virtual</strong>. Hacé clic en el botón de abajo para restablecerla:
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
