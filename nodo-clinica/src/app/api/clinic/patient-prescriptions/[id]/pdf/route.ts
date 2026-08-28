import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { generatePrescriptionPdf } from "@/lib/pdf/generator";
import { isPrescriptionExpired } from "@/lib/clinic/prescription-expiration";
import type { Medication } from "@/types";

export const dynamic = "force-dynamic";

type ProfessionalRow = {
  full_name: string;
  specialty?: string | null;
  license_number?: string | null;
  signature_text?: string | null;
  signature_image_url?: string | null;
};

type InstitutionSnapshot = {
  name: string;
  city: string | null;
  address: string | null;
  extraInfo: string | null;
};

/**
 * Patient-portal download for a standalone receta ("Mis recetas"),
 * authenticated by session — unlike `[accessToken]/pdf/route.ts` (the public
 * magic-link endpoint used by the pre-payment/no-login flow, left untouched).
 * Ownership is enforced in code against `patient_id` (mirrors the pattern in
 * `prescriptions/[accessToken]/route.ts`'s `authorizeAndLoad`, whose "owner"
 * is `doctor_id`) rather than relying on RLS — same rationale documented
 * there: this schema's RLS gates on `current_org_id()`, which doesn't
 * resolve for every auth path `requireAuth()` accepts.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  if (user.role !== "patient") {
    return NextResponse.json(
      { error: "Debe iniciar sesión como paciente" },
      { status: 401 },
    );
  }

  const { data: patientRow } = await supabase
    .from("patients")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!patientRow?.id) {
    return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;

  const { data: prescription } = await svc
    .from("prescriptions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!prescription) {
    return NextResponse.json({ error: "Receta no encontrada" }, { status: 404 });
  }

  if (prescription.patient_id !== patientRow.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const paymentStatus = prescription.payment_status as string | null;
  const sentAt = prescription.sent_at as string | null;
  if ((paymentStatus !== "confirmed" && paymentStatus !== "waived") || !sentAt) {
    return NextResponse.json(
      { error: "Esta receta todavía no fue enviada" },
      { status: 403 },
    );
  }

  if (isPrescriptionExpired(sentAt)) {
    return NextResponse.json({ error: "Esta receta ya venció" }, { status: 410 });
  }

  const medications = (
    Array.isArray(prescription.medications) ? prescription.medications : []
  ) as Medication[];
  if (!medications.length) {
    return NextResponse.json(
      { error: "La receta no tiene medicamentos" },
      { status: 422 },
    );
  }

  const { data: professionalRow } = await svc
    .from("professionals")
    .select("*")
    .eq("id", prescription.doctor_id)
    .maybeSingle();

  if (!professionalRow) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  let patientName: string | null = prescription.patient_full_name ?? null;
  if (!patientName && prescription.patient_id) {
    const { data: patientNameRow } = await svc
      .from("patients")
      .select("full_name")
      .eq("id", prescription.patient_id)
      .maybeSingle();
    patientName = patientNameRow?.full_name ?? null;
  }
  patientName = patientName || "Paciente";

  const professional = professionalRow as ProfessionalRow;
  const institutionSnapshot = (prescription.institution_snapshot ?? null) as
    | InstitutionSnapshot
    | null;

  const pdfDoc = generatePrescriptionPdf({
    doctor: {
      full_name: professional.full_name,
      specialty: professional.specialty ?? "",
      license_number: professional.license_number ?? "",
    },
    patientName,
    medications,
    signatureText:
      professional.signature_text || `Dr/a. ${professional.full_name}`,
    signatureImageData: professional.signature_image_url ?? undefined,
    institution: institutionSnapshot
      ? {
          name: institutionSnapshot.name,
          city: institutionSnapshot.city ?? undefined,
          address: institutionSnapshot.address ?? undefined,
          extraInfo: institutionSnapshot.extraInfo ?? undefined,
        }
      : undefined,
    notes: prescription.notes ?? undefined,
    // Same rationale as [accessToken]/pdf/route.ts: the date printed is the
    // real emission date (sent_at), not whenever the patient happens to
    // click "download".
    issuedAt: new Date(sentAt),
  });

  const buffer = Buffer.from(pdfDoc.output("arraybuffer"));
  const fileName = `receta-${patientName.replace(/\s+/g, "-")}.pdf`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
    },
  });
}
