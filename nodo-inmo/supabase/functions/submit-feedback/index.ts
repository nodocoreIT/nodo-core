import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyFeedbackToLanding } from "../_shared/feedback-notify.ts";

type FeedbackCategory = "bug" | "idea" | "bloat";

type FeedbackBody = {
  category: FeedbackCategory;
  content: string;
  orgId?: string | null;
  redirectTo?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json("ok", 200);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing auth header" }, 401);
  }

  const callerClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: FeedbackBody;
  try {
    body = (await req.json()) as FeedbackBody;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { category, content, orgId, redirectTo } = body;

  if (!category || !content?.trim()) {
    return json({ error: "category and content are required" }, 400);
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Insert into shared.feedback
  const { error: insertError } = await adminClient
    .schema("shared")
    .from("feedback")
    .insert({
      org_id: orgId ?? null,
      user_id: user.id,
      category,
      content: content.trim(),
      metadata: {
        dictated: false,
        source_node: "inmo",
      },
    });

  if (insertError) {
    console.error("submit-feedback: insert error", insertError);
    return json({ error: "Error al guardar el feedback" }, 500);
  }

  // Best-effort: notify nodo-landing (email + panel notification)
  const landingRedirectTo = redirectTo ?? Deno.env.get("NODO_LANDING_URL") ?? "";
  const notify = await notifyFeedbackToLanding(landingRedirectTo, {
    category,
    content: content.trim(),
    sourceNode: "inmo",
    userEmail: user.email,
  });

  if (!notify.sent) {
    console.warn("submit-feedback: notify skipped —", notify.reason);
  }

  return json({ ok: true, notified: notify.sent });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
