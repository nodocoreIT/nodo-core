import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import dns from "node:dns/promises";

export async function POST(request: NextRequest) {
  const { orgId, domain } = await request.json();

  if (!orgId || !domain) {
    return NextResponse.json(
      { error: "orgId and domain required" },
      { status: 400 },
    );
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Get the verification token for this org's store
  const { data: store } = await admin
    .schema("nodo_tienda")
    .from("stores")
    .select("domain_verify_token, custom_domain")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!store || !store.domain_verify_token) {
    return NextResponse.json(
      { error: "Store or token not found" },
      { status: 404 },
    );
  }

  // Check TXT record
  try {
    const records = await dns.resolveTxt(domain);
    const flat = records.flat();
    const verified = flat.some(
      (r) => r === `nodo-verify=${store.domain_verify_token}`,
    );

    if (!verified) {
      return NextResponse.json({
        verified: false,
        message: "TXT record not found yet",
      });
    }

    // Mark as verified
    await admin
      .schema("nodo_tienda")
      .from("stores")
      .update({
        domain_verified_at: new Date().toISOString(),
        custom_domain: domain,
      })
      .eq("org_id", orgId);

    return NextResponse.json({ verified: true });
  } catch {
    return NextResponse.json({
      verified: false,
      message: "DNS lookup failed",
    });
  }
}
