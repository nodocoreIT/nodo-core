import { NextResponse } from "next/server";
import { sendPausedNodeAccessEmail, isMailConfigured } from "@/lib/mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Notifies CONTACT_TO (Zoho) when a user tries to sign into a paused nodo.
 * Public endpoint — only accepts email + unitCode; no secrets returned.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email =
    typeof (body as { email?: unknown })?.email === "string"
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";
  const unitCode =
    typeof (body as { unitCode?: unknown })?.unitCode === "string"
      ? (body as { unitCode: string }).unitCode.trim()
      : "";
  const nodeLabel =
    typeof (body as { nodeLabel?: unknown })?.nodeLabel === "string"
      ? (body as { nodeLabel: string }).nodeLabel.trim()
      : undefined;

  if (!email || !EMAIL_RE.test(email) || !unitCode) {
    return NextResponse.json(
      { error: "email y unitCode son requeridos" },
      { status: 400 },
    );
  }

  if (!isMailConfigured()) {
    console.warn(
      "paused-notify skipped: SMTP env vars not configured (ZOHO_SMTP_USER / ZOHO_SMTP_PASSWORD).",
    );
    return NextResponse.json({ ok: true, emailed: false });
  }

  try {
    await sendPausedNodeAccessEmail({ email, unitCode, nodeLabel });
    return NextResponse.json({ ok: true, emailed: true });
  } catch (err) {
    console.error("paused-notify email failed:", err);
    return NextResponse.json(
      { error: "No se pudo enviar el aviso" },
      { status: 502 },
    );
  }
}
