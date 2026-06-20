import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Proxy route: landing panel calls this with { token, action }.
// We forward the request to the inmo accept-invitation Edge Function using
// the service role key so we can bypass inmo auth session requirements.
// The token itself is the security proof; we also link invitee_user_id to the
// currently authenticated landing panel user.

function getInmoFunctionUrl(functionName: string): string | null {
  const inmoUrl =
    process.env.NEXT_PUBLIC_NODO_INMO_SUPABASE_URL ??
    process.env.NODO_INMO_SUPABASE_URL;
  if (!inmoUrl) return null;
  return `${inmoUrl}/functions/v1/${functionName}`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { token: string; action?: "accept" | "reject" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { token, action = "accept" } = body;
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const functionUrl = getInmoFunctionUrl("accept-invitation");
  if (!functionUrl) {
    return NextResponse.json(
      { error: "Inmo Supabase URL not configured" },
      { status: 503 },
    );
  }

  const serviceKey = process.env.NODO_INMO_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "Inmo service key not configured" },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ token, action, userId: user.id }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 },
    );
  }
}
