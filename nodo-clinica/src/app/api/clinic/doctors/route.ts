import { NextRequest, NextResponse } from "next/server";
import { isLocalMode } from "@/lib/clinic/config";
import { readDb, publicDoctor, publicDoctorSummary } from "@/lib/clinic/local-db";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { professionalHasMercadoPagoConnection } from "@/lib/clinic/db/payments";
import { isUnassignedSpecialty } from "@/lib/clinic/unassigned-specialty";

export const dynamic = "force-dynamic";

function isActiveDoctor(d: { subscriptionStatus?: string }) {
  return (
    !d.subscriptionStatus ||
    d.subscriptionStatus === "active" ||
    d.subscriptionStatus === "demo"
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

    const doctors = db.doctors
      .filter(isActiveDoctor)
      .filter((d) => !isUnassignedSpecialty(d.specialty))
      .map(publicDoctor);
    return NextResponse.json(doctors);
  }

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const serviceClient = await createServiceClient();

  if (doctorId) {
    const { data: professional } = await serviceClient
      .from("professionals")
      .select("id, full_name, specialty, license_number, profile_photo_url, org_id, enabled_at")
      .eq("id", doctorId)
      .maybeSingle();

    if (!professional || !professional.enabled_at) {
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

    const { data: inPersonRow } = await serviceClient
      .from("in_person_availability")
      .select("enabled")
      .eq("professional_id", professional.id)
      .maybeSingle();

    return NextResponse.json({
      id: professional.id,
      fullName: professional.full_name,
      specialty: professional.specialty,
      licenseNumber: professional.license_number,
      profilePhotoUrl: professional.profile_photo_url,
      offersInPerson: Boolean(inPersonRow?.enabled),
      payment: {
        ...safePayment,
        ...withTransferFallback(safePayment),
        mercadopagoReady: mpConnected && consultationFee > 0,
      },
    });
  }

  const { data: professionals } = await serviceClient
    .from("professionals")
    .select("id, full_name, specialty, license_number, profile_photo_url")
    .not("enabled_at", "is", null);

  const activeProfessionals = (professionals ?? []).filter(
    (p) => !isUnassignedSpecialty(p.specialty),
  );

  const { data: officeSettingsRows } = activeProfessionals.length
    ? await serviceClient
        .from("office_settings")
        .select("professional_id, payment")
        .in(
          "professional_id",
          activeProfessionals.map((p) => p.id),
        )
    : { data: [] };

  const paymentByProfessionalId = new Map<string, Record<string, unknown>>();
  for (const row of officeSettingsRows ?? []) {
    const payment = (row.payment as Record<string, unknown>) ?? {};
    const {
      mercadopagoAccessToken: _at,
      mercadopagoRefreshToken: _rt,
      mercadopagoPublicKey: _pk,
      ...safePayment
    } = payment;
    paymentByProfessionalId.set(row.professional_id, {
      ...safePayment,
      ...withTransferFallback(safePayment),
    });
  }

  return NextResponse.json(
    activeProfessionals.map((p) => ({
      id: p.id,
      fullName: p.full_name,
      specialty: p.specialty,
      licenseNumber: p.license_number,
      profilePhotoUrl: p.profile_photo_url,
      payment: paymentByProfessionalId.get(p.id) ?? {},
    })),
  );
}

/**
 * Cuando el médico no cargó una cuenta bancaria alternativa para transferencia
 * manual (payment.alias / payment.cbu), usamos los datos de su cuenta de
 * Mercado Pago (mercadopagoAlias / mercadopagoCvu) como alias/CBU a mostrarle
 * al paciente, ya que esa cuenta también acepta transferencias comunes.
 */
function withTransferFallback(safePayment: Record<string, unknown>) {
  return {
    alias: (safePayment.alias as string | undefined) || (safePayment.mercadopagoAlias as string | undefined),
    cbu: (safePayment.cbu as string | undefined) || (safePayment.mercadopagoCvu as string | undefined),
    beneficiaryName:
      (safePayment.beneficiaryName as string | undefined) ||
      (safePayment.mercadopagoBeneficiaryName as string | undefined),
  };
}
