import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Solo administradores." }, { status: 403 });
  }

  const idsParam = request.nextUrl.searchParams.get("client_unit_ids") ?? "";
  const singleId = request.nextUrl.searchParams.get("client_unit_id") ?? "";
  const unitIds = idsParam
    ? idsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : singleId
      ? [singleId]
      : [];

  if (unitIds.length === 0) {
    return NextResponse.json({ error: "client_unit_id(s) requerido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: docs, error } = await admin
    .from("registration_verification_docs")
    .select("id, client_unit_id, doc_type, storage_path, file_name, status, created_at")
    .in("client_unit_id", unitIds)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const withUrls = await Promise.all(
    (docs ?? []).map(async (doc) => {
      const { data: signed } = await admin.storage
        .from("registration-docs")
        .createSignedUrl(doc.storage_path, 3600);
      return {
        ...doc,
        signed_url: signed?.signedUrl ?? null,
      };
    }),
  );

  const byUnit: Record<string, typeof withUrls> = {};
  for (const doc of withUrls) {
    const arr = byUnit[doc.client_unit_id] ?? [];
    arr.push(doc);
    byUnit[doc.client_unit_id] = arr;
  }

  return NextResponse.json({ docs: withUrls, by_unit: byUnit });
}
