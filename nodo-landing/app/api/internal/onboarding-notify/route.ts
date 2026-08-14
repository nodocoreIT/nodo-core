import { NextRequest, NextResponse } from "next/server";
import { isMailConfigured, sendOnboardingPendingEmail } from "@/lib/mail";
import { notifyN8nWebhook } from "@/lib/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

type OnboardingNotifyPayload = {
  type: "paciente" | "medico";
  nombre: string;
  email: string;
  sourceNode: string;
};

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  const inmoKey = process.env.NODO_INMO_SERVICE_ROLE_KEY;
  const landingKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return (!!inmoKey && token === inmoKey) || (!!landingKey && token === landingKey);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: OnboardingNotifyPayload;
  try {
    body = (await request.json()) as OnboardingNotifyPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, nombre, email, sourceNode } = body;

  if (!type || !nombre?.trim() || !email?.trim() || !sourceNode) {
    return NextResponse.json(
      { error: "Missing required fields: type, nombre, email, sourceNode" },
      { status: 400 },
    );
  }

  const results: {
    email: boolean;
    emailError?: string;
    webhook: boolean;
    webhookError?: string;
    notification: boolean;
    notificationError?: string;
  } = {
    email: false,
    webhook: false,
    notification: false,
  };

  // 1. Send email notification
  if (isMailConfigured()) {
    try {
      await sendOnboardingPendingEmail({ type, nombre: nombre.trim(), email: email.trim(), sourceNode });
      results.email = true;
    } catch (err) {
      results.emailError = err instanceof Error ? err.message : String(err);
      console.error("onboarding-notify: email error", err);
    }
  } else {
    results.emailError = "SMTP not configured";
  }

  // 2. Notify n8n webhook
  try {
    const webhookResult = await notifyN8nWebhook("onboarding_completed", {
      type,
      nombre: nombre.trim(),
      email: email.trim(),
      sourceNode,
    });
    results.webhook = webhookResult.sent;
    if (webhookResult.error) results.webhookError = webhookResult.error;
  } catch (err) {
    results.webhookError = err instanceof Error ? err.message : String(err);
    console.error("onboarding-notify: webhook error", err);
  }

  // 3. Insert panel notification so the dashboard bell can surface it
  try {
    const admin = createAdminClient("nodo_core");
    const { error } = await admin.from("panel_notifications").insert({
      kind: "onboarding_completed",
      category: type,
      content: `Nuevo registro: ${nombre.trim()} (${email.trim()})`,
      source_node: sourceNode,
    });
    if (error) throw error;
    results.notification = true;
  } catch (err) {
    results.notificationError = err instanceof Error ? err.message : String(err);
    console.error("onboarding-notify: notification insert error", err);
  }

  // Return 200 even with partial failures so the caller doesn't retry
  return NextResponse.json({ ok: true, ...results });
}
