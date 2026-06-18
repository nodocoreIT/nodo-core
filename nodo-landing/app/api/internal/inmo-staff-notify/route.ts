import { NextRequest, NextResponse } from "next/server";
import {
  isMailConfigured,
  sendInmoStaffAddedEmail,
  sendInmoStaffInviteEmail,
} from "@/lib/mail";

type InvitePayload = {
  kind: "invite";
  email: string;
  name: string;
  orgName: string;
  actionUrl: string;
};

type AddedPayload = {
  kind: "added";
  email: string;
  name: string;
  orgName: string;
  loginUrl: string;
};

type NotifyPayload = InvitePayload | AddedPayload;

function isAuthorized(request: NextRequest): boolean {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return false;

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  return token === serviceKey;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  if (!email || !name || !orgName || !body.kind) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    if (body.kind === "invite") {
      if (!body.actionUrl?.trim()) {
        return NextResponse.json({ error: "Missing actionUrl" }, { status: 400 });
      }

      await sendInmoStaffInviteEmail({
        email,
        name,
        orgName,
        inviteUrl: body.actionUrl.trim(),
      });
    } else {
      if (!body.loginUrl?.trim()) {
        return NextResponse.json({ error: "Missing loginUrl" }, { status: 400 });
      }

      await sendInmoStaffAddedEmail({
        email,
        name,
        orgName,
        loginUrl: body.loginUrl.trim(),
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
