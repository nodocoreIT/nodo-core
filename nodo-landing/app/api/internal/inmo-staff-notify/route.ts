import { NextRequest, NextResponse } from "next/server";
import {
  isMailConfigured,
  sendStaffAddedEmail,
  sendStaffInviteEmail,
} from "@/lib/mail";

type InvitePayload = {
  kind: "invite";
  email: string;
  name: string;
  orgName: string;
  actionUrl: string;
  inviterName?: string;
  nodeLabel?: string;
};

type AddedPayload = {
  kind: "added";
  email: string;
  name: string;
  orgName: string;
  loginUrl: string;
  inviterName?: string;
  nodeLabel?: string;
};

type NotifyPayload = InvitePayload | AddedPayload;

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  // The Edge Function sends nodo-inmo's SUPABASE_SERVICE_ROLE_KEY (a different
  // Supabase project from nodo-landing). Accept that key as the primary auth.
  // Also accept landing's own service key as a fallback.
  const inmoKey = process.env.NODO_INMO_SERVICE_ROLE_KEY;
  const landingKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return (!!inmoKey && token === inmoKey) || (!!landingKey && token === landingKey);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    const t = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
    return NextResponse.json({
      error: "Unauthorized",
      _dbg: {
        tokenStart: t.slice(0, 8),
        inmoKeyStart: (process.env.NODO_INMO_SERVICE_ROLE_KEY ?? "").slice(0, 8) || "unset",
        landingKeyStart: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").slice(0, 8) || "unset",
        tokenLen: t.length,
        inmoKeyLen: (process.env.NODO_INMO_SERVICE_ROLE_KEY ?? "").length,
        landingKeyLen: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").length,
      },
    }, { status: 401 });
  }

  if (!isMailConfigured()) {
    return NextResponse.json(
      { error: "SMTP no configurado: faltan ZOHO_SMTP_USER y/o ZOHO_SMTP_PASSWORD." },
      { status: 503 },
    );
  }

  let body: NotifyPayload;
  try {
    body = (await request.json()) as NotifyPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  const orgName = body.orgName?.trim();
  const inviterName = body.inviterName?.trim();
  const nodeLabel = body.nodeLabel?.trim() || "NODO | Inmo";

  if (!email || !name || !orgName || !body.kind) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    if (body.kind === "invite") {
      if (!body.actionUrl?.trim()) {
        return NextResponse.json({ error: "Missing actionUrl" }, { status: 400 });
      }

      await sendStaffInviteEmail({
        email,
        name,
        orgName,
        inviteUrl: body.actionUrl.trim(),
        inviterName,
        nodeLabel,
      });
    } else {
      if (!body.loginUrl?.trim()) {
        return NextResponse.json({ error: "Missing loginUrl" }, { status: 400 });
      }

      await sendStaffAddedEmail({
        email,
        name,
        orgName,
        loginUrl: body.loginUrl.trim(),
        inviterName,
        nodeLabel,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("inmo-staff-notify:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al enviar el correo" },
      { status: 500 },
    );
  }
}
