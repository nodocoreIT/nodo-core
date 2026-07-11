import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const doctorId = request.nextUrl.searchParams.get("doctorId");

  // Use service client so patients can see all professionals regardless of RLS
  const serviceClient = await createServiceClient();

  if (doctorId) {
    const { data: professional } = await serviceClient
      .from("professionals")
      .select("id, full_name, specialty, license_number, profile_photo_url, org_id")
      .eq("id", doctorId)
      .maybeSingle();

    if (!professional) {
      return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
    }

    const { data: officeSettings } = await serviceClient
      .from("office_settings")
      .select("payment")
      .eq("professional_id", professional.id)
      .maybeSingle();

    const payment = (officeSettings?.payment as Record<string, unknown>) ?? {};
    const { mercadopagoAccessToken: _at, mercadopagoRefreshToken: _rt, mercadopagoPublicKey: _pk, ...safePayment } = payment as {
      mercadopagoAccessToken?: unknown;
      mercadopagoRefreshToken?: unknown;
      mercadopagoPublicKey?: unknown;
      [k: string]: unknown;
    };

    return NextResponse.json({
      id: professional.id,
      fullName: professional.full_name,
      specialty: professional.specialty,
      licenseNumber: professional.license_number,
      profilePhotoUrl: professional.profile_photo_url,
      payment: safePayment,
    });
  }

  const { data: professionals } = await serviceClient
    .from("professionals")
    .select("id, full_name, specialty, license_number, profile_photo_url");

  return NextResponse.json(
    (professionals ?? []).map((p) => ({
      id: p.id,
      fullName: p.full_name,
      specialty: p.specialty,
      licenseNumber: p.license_number,
      profilePhotoUrl: p.profile_photo_url,
    })),
  );
}
