import "server-only";
import nodemailer from "nodemailer";
import type { TaskNotificationType } from "@/lib/panel/task-notification-copy";

// Zoho SMTP transport. Credentials live in env vars so they never ship to the
// client. Host/port default to Zoho's standard SSL endpoint.
const HOST = process.env.ZOHO_SMTP_HOST ?? "smtp.zoho.com";
const PORT = Number(process.env.ZOHO_SMTP_PORT ?? 465);
const USER = process.env.ZOHO_SMTP_USER;
const PASS = process.env.ZOHO_SMTP_PASSWORD;
const CONTACT_TO = process.env.CONTACT_TO ?? "contacto@nodocore.com.ar";
// Ops inbox for internal server-to-server notifications (feedback, onboarding
// pending review). Fixed on purpose — doesn't depend on CONTACT_TO.
const NODOCORE_LP_EMAIL = "nodocore.lp@gmail.com";

export function isMailConfigured(): boolean {
  return Boolean(USER && PASS);
}

type NodeBrandTheme = { brand: string; buttonText: string; linkColor: string };

// Per-node brand colors — must match lib/node-accents.ts, the source of truth
// already used across the real login/landing UI. Do not use the admin panel's
// NODE_PILL_COLORS (usuarios-nodo/page.tsx) — those are decorative and drift
// from the real brand. "salud" is a legacy alias for "clinica" (same product,
// see isClinicaLoginNode in node-accents.ts); "inmo" has no entry on purpose —
// its real accent is the default orange (see getNodeAccentBySlug).
const NODE_BRAND_COLORS: Record<string, { brand: string; light: boolean }> = {
  autos: { brand: "#D12D3C", light: false },
  automotores: { brand: "#D12D3C", light: false },
  finanzas: { brand: "#43936C", light: false },
  clinica: { brand: "#0D9488", light: false },
  salud: { brand: "#0D9488", light: false },
  obra: { brand: "#CA8A04", light: false },
  contable: { brand: "#7C3AED", light: false },
  ecommerce: { brand: "#FFF600", light: true },
};
const DEFAULT_BRAND_COLOR = { brand: "#DA5A0E", light: false };

/** Strips a "NODO | X" / "Nodo X" / "nodo-x" prefix down to the bare slug. */
function brandKeyFromLabel(value: string): string {
  return value
    .trim()
    .replace(/^nodo[\s|-]*/i, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "");
}

/** Accepts either a raw slug ("autos") or a display label ("NODO | Autos"). */
function resolveNodeBrand(unitCodeOrLabel: string): NodeBrandTheme {
  const { brand, light } = NODE_BRAND_COLORS[brandKeyFromLabel(unitCodeOrLabel)] ?? DEFAULT_BRAND_COLOR;
  return {
    brand,
    buttonText: light ? "#000000" : "#ffffff",
    linkColor: light ? "#857f00" : brand,
  };
}

/** Public-URL logo (white wordmark) — avoids CID attachment delays in mail clients. */
function nodoWhiteLogoHtml(heightPx = 44): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.nodocore.com.ar").replace(/\/$/, "");
  const logoUrl = `${appUrl}/logos/logo%20compuesto%20estrella%20az%20letra%20blanca_50.png`;
  return `<img src="${logoUrl}" alt="NODO Core" style="height:${heightPx}px;width:auto;display:inline-block;"/>`;
}

/** Shared shell for every transactional email: brand header, white body, footer. */
function renderNodoEmailShell({
  brandColor,
  buttonText,
  linkColor,
  title,
  subtitleHtml,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  secondaryHtml,
  footerNote,
}: {
  brandColor: string;
  buttonText: string;
  linkColor: string;
  title: string;
  subtitleHtml?: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  /** Optional secondary link/text rendered right under the CTA button. */
  secondaryHtml?: string;
  footerNote: string;
}): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">

      <!-- Header brandado -->
      <div style="background-color:${brandColor};padding:36px 48px 28px;text-align:center;">
        ${nodoWhiteLogoHtml()}
      </div>

      <!-- Body -->
      <div style="background:#ffffff;padding:32px;">
        <h2 style="color:#0a0a0a;margin:0 0 8px;font-size:22px;font-weight:800;text-align:center;">
          ${title}
        </h2>
        ${subtitleHtml ? `<p style="color:#374151;font-size:15px;line-height:1.6;text-align:center;margin:0 0 8px;">${subtitleHtml}</p>` : ""}
        <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;"/>
        <div style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 24px;">
          ${bodyHtml}
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin:0 0 ${secondaryHtml ? "12px" : "28px"};">
          <a href="${ctaUrl}"
             style="background-color:${brandColor};color:${buttonText};padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:800;display:inline-block;font-size:15px;letter-spacing:.01em;">
            ${ctaLabel}
          </a>
        </div>

        ${secondaryHtml ? `<div style="text-align:center;margin:0 0 28px;font-size:13px;">${secondaryHtml}</div>` : ""}

        <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:0;">
          Si el botón no funciona, copiá este enlace en tu navegador:<br/>
          <a href="${ctaUrl}" style="color:${linkColor};word-break:break-all;">${ctaUrl}</a>
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:16px 32px;text-align:center;">
        <p style="color:#9ca3af;font-size:11px;margin:0;">
          ${footerNote}
        </p>
        <p style="color:#d1d5db;font-size:11px;margin:6px 0 0;">
          © 2026 NODO Core · nodocore.com.ar
        </p>
      </div>

    </div>
  `;
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
  const theme = resolveNodeBrand("clinica");

  await transporter.sendMail({
    from: `"NODO Core · Registro" <${USER}>`,
    to: email,
    subject: `Verificá tu registro en NODO | Clínica`,
    text: `Hola ${nombre},\n\nGracias por registrarte en NODO | Clínica (${plan.toUpperCase()}). Para completar tu registro, por favor verifica tu cuenta haciendo clic en el siguiente enlace:\n\n${verificationUrl}\n\nSi no realizaste esta solicitud, podés ignorar este correo.\n\nSaludos,\nEl equipo de NODO Core`,
    html: renderNodoEmailShell({
      brandColor: theme.brand,
      buttonText: theme.buttonText,
      linkColor: theme.linkColor,
      title: "Verificá tu registro",
      subtitleHtml: "en <strong>NODO | Clínica</strong>",
      bodyHtml: `Hola <strong>${nombre}</strong>,<br/><br/>Completá tu solicitud de registro para el plan <strong>${plan.toUpperCase()}</strong> haciendo clic en el botón de abajo:`,
      ctaLabel: "Verificar mi Cuenta",
      ctaUrl: verificationUrl,
      footerNote: "Si no realizaste esta solicitud, podés ignorar este correo.",
    }),
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
  const theme = resolveNodeBrand("finanzas");

  await transporter.sendMail({
    from: `"NODO Finanzas Personales" <${USER}>`,
    to: email,
    subject: "Verificá tu cuenta en NODO Finanzas Personales",
    text: `Hola ${nombre},\n\nGracias por registrarte en NODO Finanzas Personales. Para activar tu cuenta, verificá tu correo con este enlace:\n\n${verificationUrl}\n\nEl enlace vence en 24 horas.\n\nSaludos,\nEl equipo de NODO Core`,
    html: renderNodoEmailShell({
      brandColor: theme.brand,
      buttonText: theme.buttonText,
      linkColor: theme.linkColor,
      title: "Verificá tu cuenta",
      subtitleHtml: "en <strong>NODO Finanzas Personales</strong>",
      bodyHtml: `Hola <strong>${nombre}</strong>,<br/><br/>Confirmá tu correo para empezar a usar tu cuenta:`,
      ctaLabel: "Verificar mi cuenta",
      ctaUrl: verificationUrl,
      footerNote: "Este enlace vence en 24 horas · Si no te registraste, ignorá este correo.",
    }),
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
  const theme = resolveNodeBrand("clinica");

  await transporter.sendMail({
    from: `"NODO Clínica Virtual" <${USER}>`,
    to: email,
    subject: `Activá tu cuenta en NODO | Clínica`,
    text: `Hola ${nombre},\n\nGracias por registrarte como paciente en NODO | Clínica. Para activar tu cuenta y acceder a las videoconsultas y turnos, hacé clic en el siguiente enlace:\n\n${verificationUrl}\n\nSi no realizaste esta solicitud, podés ignorar este correo.\n\nSaludos,\nEl equipo de NODO Clínica Virtual`,
    html: renderNodoEmailShell({
      brandColor: theme.brand,
      buttonText: theme.buttonText,
      linkColor: theme.linkColor,
      title: "Activá tu cuenta",
      subtitleHtml: "en <strong>NODO | Clínica</strong>",
      bodyHtml: `Hola <strong>${nombre}</strong>,<br/><br/>Activá tu cuenta de paciente haciendo clic en el botón de abajo:`,
      ctaLabel: "Activar mi Cuenta",
      ctaUrl: verificationUrl,
      footerNote: "Si no realizaste esta solicitud, podés ignorar este correo.",
    }),
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

  const theme = resolveNodeBrand(nodeSlug || nodeLabel);

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
    html: renderNodoEmailShell({
      brandColor: theme.brand,
      buttonText: theme.buttonText,
      linkColor: theme.linkColor,
      title: "Restablecé tu cuenta",
      subtitleHtml: `en <strong>${nodeLabel}</strong>`,
      bodyHtml: "Recibimos una solicitud para restablecer el acceso a tu cuenta.<br/>Hacé clic en el botón de abajo para configurar tu contraseña e ingresar:",
      ctaLabel: "Restablecer cuenta",
      ctaUrl: recoveryUrl,
      footerNote: "Si no realizaste esta solicitud, podés ignorar este correo.",
    }),
  });
}

export async function sendInmoStaffInviteEmail({
  name,
  email,
  inviteUrl,
  orgName,
  nodeLabel = "NODO | Inmo",
}: {
  name: string;
  email: string;
  inviteUrl: string;
  orgName: string;
  nodeLabel?: string;
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
  const theme = resolveNodeBrand(nodeLabel);

  await transporter.sendMail({
    from: `"${nodeLabel}" <${USER}>`,
    to: email,
    subject: `Invitación al equipo de ${orgName} en ${nodeLabel}`,
    text: `Hola ${name},\n\nTe invitaron a unirte al equipo de ${orgName} en ${nodeLabel}. Para activar tu cuenta, elegí tu contraseña en el siguiente enlace:\n\n${inviteUrl}\n\nSi no esperabas esta invitación, podés ignorar este correo.\n\nSaludos,\nEl equipo de NODO Core`,
    html: renderNodoEmailShell({
      brandColor: theme.brand,
      buttonText: theme.buttonText,
      linkColor: theme.linkColor,
      title: `Te invitaron a ${nodeLabel}`,
      bodyHtml: `Hola <strong>${name}</strong>,<br/><br/>Te sumaron al equipo de <strong>${orgName}</strong>. Activá tu acceso y elegí tu contraseña:`,
      ctaLabel: "Activar mi cuenta",
      ctaUrl: inviteUrl,
      footerNote: "Si no esperabas esta invitación, podés ignorar este correo.",
    }),
  });
}

export async function sendInmoStaffAddedEmail({
  name,
  email,
  orgName,
  loginUrl,
  nodeLabel = "NODO | Inmo",
}: {
  name: string;
  email: string;
  orgName: string;
  loginUrl: string;
  nodeLabel?: string;
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
  const theme = resolveNodeBrand(nodeLabel);

  await transporter.sendMail({
    from: `"${nodeLabel}" <${USER}>`,
    to: email,
    subject: `Te agregaron al equipo de ${orgName} en ${nodeLabel}`,
    text: `Hola ${name},\n\nTe agregaron al equipo de ${orgName} en ${nodeLabel}. Ya podés ingresar con tu email y contraseña habituales:\n\n${loginUrl}\n\nSaludos,\nEl equipo de NODO Core`,
    html: renderNodoEmailShell({
      brandColor: theme.brand,
      buttonText: theme.buttonText,
      linkColor: theme.linkColor,
      title: "Acceso habilitado",
      subtitleHtml: `en <strong>${nodeLabel}</strong>`,
      bodyHtml: `Hola <strong>${name}</strong>,<br/><br/>Te agregaron al equipo de <strong>${orgName}</strong>. Ingresá con tu email y contraseña habituales:`,
      ctaLabel: `Ingresar a ${nodeLabel}`,
      ctaUrl: loginUrl,
      footerNote: "Si no reconocés esta actividad, contactanos respondiendo este correo.",
    }),
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
  const theme = resolveNodeBrand("inmo");

  await transporter.sendMail({
    from: `"NODO Inmo" <${USER}>`,
    to: email,
    subject: `Activá tu cuenta en NODO | Inmo`,
    text: `Hola ${nombre},\n\nGracias por registrarte en NODO | Inmo. Para activar tu cuenta de inmobiliaria y acceder al panel de gestión, hacé clic en el siguiente enlace:\n\n${verificationUrl}\n\nSi no realizaste esta solicitud, podés ignorar este correo.\n\nSaludos,\nEl equipo de NODO Inmo`,
    html: renderNodoEmailShell({
      brandColor: theme.brand,
      buttonText: theme.buttonText,
      linkColor: theme.linkColor,
      title: "Activá tu cuenta",
      subtitleHtml: "en <strong>NODO | Inmo</strong>",
      bodyHtml: `Hola <strong>${nombre}</strong>,<br/><br/>Activá tu cuenta haciendo clic en el botón de abajo:`,
      ctaLabel: "Activar mi Cuenta",
      ctaUrl: verificationUrl,
      footerNote: "Si no realizaste esta solicitud, podés ignorar este correo.",
    }),
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
  const theme = resolveNodeBrand("ecommerce");

  await transporter.sendMail({
    from: `"NODO Ecommerce" <${USER}>`,
    to: email,
    subject: `Activá tu cuenta en NODO | Ecommerce`,
    text: `Hola ${nombre},\n\nGracias por registrarte en NODO | Ecommerce. Para activar tu cuenta y empezar a gestionar tu tienda, hacé clic en el siguiente enlace:\n\n${verificationUrl}\n\nEl enlace vence en 24 horas.\n\nSaludos,\nEl equipo de NODO Core`,
    html: renderNodoEmailShell({
      brandColor: theme.brand,
      buttonText: theme.buttonText,
      linkColor: theme.linkColor,
      title: "¡Gracias por registrarte!",
      subtitleHtml: "en <strong>NODO | Ecommerce</strong>",
      bodyHtml: `Hola <strong>${nombre}</strong>,<br/><br/>Confirmá tu correo para activar tu cuenta y empezar a cargar productos, configurar tu tienda y recibir pedidos.`,
      ctaLabel: "Activar mi cuenta",
      ctaUrl: verificationUrl,
      footerNote: "Este enlace vence en 24 horas · Si no te registraste, ignorá este correo.",
    }),
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
  const theme = resolveNodeBrand(unitCode || nodeLabel);

  await transporter.sendMail({
    from: `"NODO Core · Activación" <${USER}>`,
    to: email,
    subject: `Tu acceso a ${nodeLabel} fue habilitado`,
    text: `Hola ${nombre},\n\nTu acceso a ${nodeLabel} está listo. Configurá tu contraseña en el primer ingreso:\n\n${loginUrl}\n\nSaludos,\nNODO Core`,
    html: renderNodoEmailShell({
      brandColor: theme.brand,
      buttonText: theme.buttonText,
      linkColor: theme.linkColor,
      title: "¡Tu cuenta fue habilitada!",
      subtitleHtml: `en <strong>${nodeLabel}</strong>`,
      bodyHtml: `Hola <strong>${nombre}</strong>,<br/><br/>Tu acceso a <strong>${nodeLabel}</strong> está listo. Hacé clic en el botón para configurar tu contraseña e ingresar:`,
      ctaLabel: "Configurar contraseña e ingresar",
      ctaUrl: loginUrl,
      footerNote: "Si no esperabas este correo, podés ignorarlo.",
    }),
  });
}

/** Sent once when a client_unit's platform subscription flips to `impago` (see lib/billing). */
export async function sendPaymentOverdueEmail({
  nombre,
  email,
  nodeLabel,
  subscriptionUrl,
  unitCode = "",
}: {
  nombre: string;
  email: string;
  nodeLabel: string;
  subscriptionUrl: string;
  unitCode?: string;
}): Promise<void> {
  const transporter = createTransporter();
  const theme = resolveNodeBrand(unitCode || nodeLabel);

  await transporter.sendMail({
    from: `"NODO Core · Suscripción" <${USER}>`,
    to: email,
    subject: `Hay un problema con el pago de tu suscripción a ${nodeLabel}`,
    text: `Hola ${nombre},\n\nNo pudimos procesar el cobro de tu suscripción a ${nodeLabel}. Mientras el pago esté pendiente, el acceso queda limitado a la sección de Suscripción para que puedas regularizarlo:\n\n${subscriptionUrl}\n\nSaludos,\nNODO Core`,
    html: renderNodoEmailShell({
      brandColor: theme.brand,
      buttonText: theme.buttonText,
      linkColor: theme.linkColor,
      title: "Hay un problema con tu pago",
      subtitleHtml: `en <strong>${nodeLabel}</strong>`,
      bodyHtml: `Hola <strong>${nombre}</strong>,<br/><br/>No pudimos procesar el cobro de tu suscripción a <strong>${nodeLabel}</strong>. Mientras el pago esté pendiente, el acceso queda limitado a la sección de Suscripción para que puedas regularizarlo.`,
      ctaLabel: "Regularizar suscripción",
      ctaUrl: subscriptionUrl,
      footerNote: "Si ya regularizaste el pago, podés ignorar este correo.",
    }),
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
  const theme = resolveNodeBrand(nodeLabel);

  await transporter.sendMail({
    from: `"NODO Core · Activación" <${USER}>`,
    to: email,
    subject: `Tu acceso a ${nodeLabel} está listo — completá tu registro`,
    text: `Hola ${nombre},\n\nTu solicitud fue aprobada. Completá tu registro en ${nodeLabel} usando este enlace:\n\n${activationUrl}\n\nEl enlace expira en 72 horas.\n\nSaludos,\nNODO Core`,
    html: renderNodoEmailShell({
      brandColor: theme.brand,
      buttonText: theme.buttonText,
      linkColor: theme.linkColor,
      title: "¡Tu acceso fue aprobado!",
      subtitleHtml: `en <strong>${nodeLabel}</strong>`,
      bodyHtml: `Hola <strong>${nombre}</strong>,<br/><br/>Tu solicitud fue habilitada. Completá tu perfil y elegí tu plan para empezar:`,
      ctaLabel: "Completar registro",
      ctaUrl: activationUrl,
      footerNote: "Este enlace expira en 72 horas.",
    }),
  });
}

/**
 * Plantilla 2 — usuario que ya tiene cuenta global y se sumó a un nodo nuevo.
 * NO se le pide elegir contraseña: usa la que ya tiene. El botón principal
 * todavía requiere click (prueba de que controla ese correo) antes de
 * vincular el nodo; el enlace secundario va directo a recuperar contraseña.
 */
export async function sendNodeLinkedEmail({
  nombre,
  email,
  nodeLabel,
  confirmUrl,
  forgotPasswordUrl,
}: {
  nombre: string;
  email: string;
  nodeLabel: string;
  confirmUrl: string;
  forgotPasswordUrl: string;
}): Promise<void> {
  const transporter = createTransporter();
  const theme = resolveNodeBrand(nodeLabel);

  await transporter.sendMail({
    from: `"NODO Core · Activación" <${USER}>`,
    to: email,
    subject: `¡Te sumaste a un nuevo nodo en nuestra plataforma!`,
    text: `Hola ${nombre},\n\nTu cuenta ya existe en NODO Core. Te vinculamos el acceso a ${nodeLabel} — confirmá el enlace para activarlo:\n\n${confirmUrl}\n\nUsá la misma contraseña que ya tenías en tus otros nodos. Si no la recordás, recuperala acá:\n${forgotPasswordUrl}\n\nSaludos,\nNODO Core`,
    html: renderNodoEmailShell({
      brandColor: theme.brand,
      buttonText: theme.buttonText,
      linkColor: theme.linkColor,
      title: "¡Te sumaste a un nuevo nodo!",
      subtitleHtml: `en <strong>${nodeLabel}</strong>`,
      bodyHtml: `Hola <strong>${nombre}</strong>,<br/><br/>Tu cuenta ya existe en NODO Core. Te vinculamos el acceso a <strong>${nodeLabel}</strong> a tu perfil — confirmá para activarlo. Usá la misma contraseña que ya tenías en tus otros nodos.`,
      ctaLabel: "Entrar a mi nuevo nodo",
      ctaUrl: confirmUrl,
      secondaryHtml: `<a href="${forgotPasswordUrl}" style="color:${theme.linkColor};text-decoration:underline;">¿No recordás tu contraseña?</a>`,
      footerNote: "Si no esperabas este correo, podés ignorarlo.",
    }),
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
  return sendInmoStaffInviteEmail({ name, email, inviteUrl, orgName, nodeLabel });
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
  return sendInmoStaffAddedEmail({ name, email, orgName, loginUrl, nodeLabel });
}

type FeedbackEmailPayload = {
  category: "bug" | "idea" | "bloat";
  content: string;
  sourceNode: string;
  userEmail?: string;
};

const FEEDBACK_SUBJECT_LABEL: Record<FeedbackEmailPayload["category"], string> = {
  idea: "Tenés una nueva idea",
  bug: "Tenés un nuevo bug",
  bloat: "Tenés una nueva mejora",
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
    to: [CONTACT_TO, NODOCORE_LP_EMAIL],
    subject: `${FEEDBACK_SUBJECT_LABEL[category]} — ${sourceNode}`,
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

/** Notify NODO Core when a user tries to log into a paused nodo. */
export async function sendPausedNodeAccessEmail({
  email,
  unitCode,
  nodeLabel,
}: {
  email: string;
  unitCode: string;
  nodeLabel?: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error(
      "SMTP no configurado: faltan ZOHO_SMTP_USER y/o ZOHO_SMTP_PASSWORD.",
    );
  }

  const label = nodeLabel?.trim() || unitCode;
  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
  });

  const safeEmail = email.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeLabel = label.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  await transporter.sendMail({
    from: `"NODO Core · Acceso" <${USER}>`,
    to: CONTACT_TO,
    replyTo: email,
    subject: `Acceso a nodo pausado: ${label} — ${email}`,
    text: `Un usuario intentó ingresar a un nodo pausado.\n\nNodo: ${label} (${unitCode})\nEmail: ${email}\nFecha: ${new Date().toISOString()}\n\nRevisá el estado del client_unit en el panel y reactivá el acceso si corresponde.`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        <div style="background:#121e2f;padding:20px 24px;color:#fff;">
          <h2 style="margin:0;font-size:18px;">Intento de acceso a nodo pausado</h2>
        </div>
        <div style="padding:24px;background:#fff;">
          <p style="margin:0 0 8px;color:#64748b;font-size:13px;">Nodo</p>
          <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#0f172a;">${safeLabel} <span style="font-weight:500;color:#64748b;">(${unitCode})</span></p>
          <p style="margin:0 0 8px;color:#64748b;font-size:13px;">Usuario</p>
          <p style="margin:0 0 16px;font-size:15px;color:#0f172a;"><a href="mailto:${safeEmail}" style="color:#DA5A0E;">${safeEmail}</a></p>
          <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">
            Revisá el estado del client_unit en el panel y reactivá el acceso si corresponde.
          </p>
        </div>
      </div>
    `,
  });
}

/** Escapes user-controlled text (task titles, profile names) before it lands in an HTML email body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Sent by the send-task-notification-emails cron for unsent nodo_core.task_notifications rows. */
const TASK_NOTIFICATION_SUBJECT_PREFIX: Record<TaskNotificationType, string> = {
  status_changed: "Cambio de estado",
  reassigned: "Tarea reasignada",
  mentioned: "Te mencionaron",
};

type OnboardingPendingPayload = {
  type: "paciente" | "medico";
  nombre: string;
  email: string;
  sourceNode: string;
};

const ONBOARDING_TYPE_LABEL: Record<OnboardingPendingPayload["type"], string> = {
  paciente: "Paciente",
  medico: "Médico",
};

/** Notifies the ops inbox when a new paciente/medico onboarding finishes and needs review. */
export async function sendOnboardingPendingEmail({
  type,
  nombre,
  email,
  sourceNode,
}: OnboardingPendingPayload): Promise<void> {
  const transporter = createTransporter();
  const typeLabel = ONBOARDING_TYPE_LABEL[type];

  await transporter.sendMail({
    from: `"NODO Core · Onboarding" <${USER}>`,
    to: NODOCORE_LP_EMAIL,
    subject: `Nuevo registro pendiente de habilitación — ${typeLabel}`,
    text: `Nuevo registro pendiente de habilitación.\n\nTipo: ${typeLabel}\nNombre: ${nombre}\nEmail: ${email}\nNodo de origen: ${sourceNode}\n\nHay que habilitar la cuenta desde el panel.`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #DEE7F1;border-radius:14px;">
        <h2 style="color:#1B2A41;margin-top:0;">Nuevo registro pendiente de habilitación</h2>
        <p style="color:#647890;line-height:1.5;">
          <strong>Tipo:</strong> ${typeLabel}<br/>
          <strong>Nombre:</strong> ${nombre}<br/>
          <strong>Email:</strong> ${email}<br/>
          <strong>Nodo de origen:</strong> ${sourceNode}
        </p>
        <p style="color:#1A2B3C;font-size:14px;">Hay que habilitar la cuenta desde el panel.</p>
      </div>
    `,
  });
}

export async function sendTaskNotificationEmail({
  to,
  taskId,
  taskTitle,
  type,
  description,
  origin,
}: {
  to: string;
  taskId: string;
  taskTitle: string;
  type: TaskNotificationType;
  /** Already-formatted copy, same text shown in the in-app bell (see use-panel-notifications.ts). */
  description: string;
  origin: string;
}): Promise<void> {
  const transporter = createTransporter();
  const panelUrl = `${origin}/panel/tareas?task=${taskId}`;
  const subjectPrefix = TASK_NOTIFICATION_SUBJECT_PREFIX[type];
  const theme = resolveNodeBrand("");

  await transporter.sendMail({
    from: `"NODO Core · Panel" <${USER}>`,
    to,
    subject: `${subjectPrefix}: ${taskTitle}`,
    text: `${description}\n\nVer en el panel: ${panelUrl}`,
    html: renderNodoEmailShell({
      brandColor: theme.brand,
      buttonText: theme.buttonText,
      linkColor: theme.linkColor,
      title: subjectPrefix,
      bodyHtml: `<p style="margin:0;">${escapeHtml(description)}</p>`,
      ctaLabel: "Ver en el panel",
      ctaUrl: panelUrl,
      footerNote: "Recibís este correo porque sos parte de una tarea en el panel de NODO Core.",
    }),
  });
}
