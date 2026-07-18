import { NextRequest, NextResponse } from "next/server";
import { isLocalMode } from "@/lib/clinic/config";
import { readDb, publicDoctor, publicDoctorSummary } from "@/lib/clinic/local-db";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { professionalHasMercadoPagoConnection } from "@/lib/clinic/db/payments";

export const dynamic = "force-dynamic";

function isActiveDoctor(d: { subscriptionStatus?: string }) {
  return (
    !d.subscriptionStatus ||
    d.subscriptionStatus === "active" ||
    d.subscriptionStatus === "trial"
  );
}

export async function GET(request: NextRequest) {
  const doctorId = request.nextUrl.searchParams.get("doctorId");

  if (isLocalMode()) {
    const db = await readDb();

    if (doctorId) {
      const doctor = db.doctors.find((d) => d.id === doctorId);
      if (!doctor || !isActiveDoctor(doctor)) {
        return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
      }
      return NextResponse.json(publicDoctorSummary(doctor));
    }

    const doctors = db.doctors.filter(isActiveDoctor).map(publicDoctor);
    return NextResponse.json(doctors);
  }

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

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
    const {
      mercadopagoAccessToken: _at,
      mercadopagoRefreshToken: _rt,
      mercadopagoPublicKey: _pk,
      ...safePayment
    } = payment as {
      mercadopagoAccessToken?: unknown;
      mercadopagoRefreshToken?: unknown;
      mercadopagoPublicKey?: unknown;
      consultationFee?: number;
      [k: string]: unknown;
    };

    const mpConnected = await professionalHasMercadoPagoConnection(professional.id);
    const consultationFee =
      typeof safePayment.consultationFee === "number" ? safePayment.consultationFee : 0;

    return NextResponse.json({
      id: professional.id,
      fullName: professional.full_name,
      specialty: professional.specialty,
      licenseNumber: professional.license_number,
      profilePhotoUrl: professional.profile_photo_url,
      payment: {
        ...safePayment,
        mercadopagoReady: mpConnected && consultationFee > 0,
      },
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
