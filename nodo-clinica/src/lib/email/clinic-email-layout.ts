import "server-only";
import { CLINIC_BRAND_LOGO_SRC } from "@/lib/clinic/brand";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clinicEmailLogoUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "https://clinica.nodocore.com.ar";
  return `${base.replace(/\/$/, "")}${CLINIC_BRAND_LOGO_SRC}`;
}

const BODY_TEXT =
  "color:#64748b;line-height:1.6;font-size:16px;word-wrap:break-word;overflow-wrap:break-word;word-break:break-word;";

export function clinicEmailTealHeader(title: string): string {
  const safeTitle = escapeHtml(title);
  const logoUrl = escapeHtml(clinicEmailLogoUrl());
  return `
        <div style="background:linear-gradient(135deg,#0f766e,#14b8a6);padding:32px 24px;text-align:center;">
          <img
            src="${logoUrl}"
            alt="Nodo Clínica"
            width="180"
            style="height:44px;width:auto;max-width:180px;display:block;margin:0 auto 16px;border:0;outline:none;text-decoration:none;"
          />
          <h1 style="color:#ffffff;margin:0;font-size:24px;line-height:1.3;word-wrap:break-word;">${safeTitle}</h1>
        </div>`;
}

export function clinicEmailParagraph(html: string): string {
  return `<p style="${BODY_TEXT}">${html}</p>`;
}

export function clinicEmailDocument(title: string, innerHtml: string): string {
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr>
            <td style="padding:0;">
              ${innerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
