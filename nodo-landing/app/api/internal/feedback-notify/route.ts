import { NextRequest, NextResponse } from "next/server";
import { isMailConfigured, sendFeedbackEmail } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";

type FeedbackPayload = {
  category: "bug" | "idea" | "bloat";
  content: string;
  sourceNode: string;
  userEmail?: string;
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

  let body: FeedbackPayload;
  try {
    body = (await request.json()) as FeedbackPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { category, content, sourceNode, userEmail } = body;

  if (!category || !content?.trim() || !sourceNode) {
    return NextResponse.json({ error: "Missing required fields: category, content, sourceNode" }, { status: 400 });
  }

  const results: { email: boolean; emailError?: string; notification: boolean; notificationError?: string } = {
    email: false,
    notification: false,
  };

  // 1. Send email notification
  if (isMailConfigured()) {
    try {
      await sendFeedbackEmail({ category, content: content.trim(), sourceNode, userEmail });
      results.email = true;
    } catch (err) {
      results.emailError = err instanceof Error ? err.message : String(err);
      console.error("feedback-notify: email error", err);
    }
  } else {
    results.emailError = "SMTP not configured";
  }

  // 2. Insert panel notification so the dashboard bell can surface it
  try {
    const admin = createAdminClient("nodo_core");
    const { error } = await admin.from("panel_notifications").insert({
      kind: "new_feedback",
      category,
      content: content.trim().slice(0, 500),
      source_node: sourceNode,
    });
    if (error) throw error;
    results.notification = true;
  } catch (err) {
    results.notificationError = err instanceof Error ? err.message : String(err);
    console.error("feedback-notify: notification insert error", err);
  }

  // Return 200 even with partial failures so the caller doesn't retry
  return NextResponse.json({ ok: true, ...results });
}
