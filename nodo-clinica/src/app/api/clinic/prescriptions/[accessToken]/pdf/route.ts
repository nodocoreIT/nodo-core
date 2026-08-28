import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { resolvePrescriptionByAccessToken } from "@/lib/clinic/prescription-token-auth";
import { generatePrescriptionPdf } from "@/lib/pdf/generator";
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
 * Fase 5 of "Recetas" — serves the real PDF for a paid standalone receta,
 * gated by the same access_token used by the magic-link landing (Fase 3).
 *
 * Regenerates the PDF server-side from the row's own saved data
 * (medications/notes/institution_snapshot) rather than a live `institutions`
 * lookup, so the letterhead reflects exactly what was issued even if the
 * médico edits the institution afterwards.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accessToken: string }> },
) {
  const { accessToken } = await params;

  const prescription = await resolvePrescriptionByAccessToken(accessToken);
  if (!prescription) {
    return NextResponse.json({ error: "Receta no encontrada" }, { status: 404 });
  }

  const paymentStatus = prescription.payment_status as string | null;
  if (paymentStatus !== "confirmed" && paymentStatus !== "waived") {
    return NextResponse.json(
      { error: "Esta receta todavía no fue pagada" },
      { status: 403 },
    );
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

  // Same untyped-cast pattern already used throughout Fase 2/3/4 for this
  // schema: the generated Database type has known gaps (SelectQueryError on
  // plain .eq("id", …) chains for professionals/patients under the
  // nodo_clinica schema client) that predate this endpoint.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;

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
    const { data: patientRow } = await svc
      .from("patients")
      .select("full_name")
      .eq("id", prescription.patient_id)
      .maybeSingle();
    patientName = patientRow?.full_name ?? null;
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
    // La fecha impresa es la del último envío/reenvío, no el momento en que
    // el paciente descarga el PDF ya pagado (que puede ser días después) —
    // una receta médica lleva la fecha en que fue emitida, no la de descarga.
    issuedAt: prescription.sent_at
      ? new Date(prescription.sent_at as string)
      : new Date(prescription.created_at as string),
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
