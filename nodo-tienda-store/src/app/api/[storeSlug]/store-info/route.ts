import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ storeSlug: string }> },
) {
  const { storeSlug } = await params;
  const admin = createSupabaseAdmin();

  const { data } = await admin
    .schema("nodo_tienda")
    .from("stores")
    .select("org_id")
    .eq("slug", storeSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "Store not found" }, { status: 404 });
  return NextResponse.json({ orgId: data.org_id });
}
