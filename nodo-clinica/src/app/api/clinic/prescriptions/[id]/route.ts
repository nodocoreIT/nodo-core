import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import {
  getPrescriptionById,
  updatePrescription,
} from "@/lib/clinic/db/clinical-records";
import { getInstitutionById } from "@/lib/clinic/db/institutions";

/**
 * Fase 6 of "Recetas" — read/edit a single receta that is still a draft.
 * A médico may only read/edit their own recetas (doctor_id ownership check,
 * mirrors `[id]/send/route.ts`). Editing is blocked once the receta was sent
 * to the patient or paid — see the PATCH handler.
 */
async function authorizeAndLoad(request: NextRequest, id: string) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return { error: authResult };
  const { user, supabase } = authResult;

  if (user.role !== "doctor" && user.role !== "medico") {
    return {
      error: NextResponse.json(
        { error: "Debe iniciar sesión como médico" },
        { status: 401 },
      ),
    };
  }

  const professional = await resolveProfessional(authResult);
  if (!professional?.id) {
    return {
      error: NextResponse.json({ error: "Médico no encontrado" }, { status: 404 }),
    };
  }

  if (!user.org_id) {
    return {
      error: NextResponse.json({ error: "org_id requerido" }, { status: 403 }),
    };
  }

  const { data: prescription, error: fetchError } = await getPrescriptionById(
    supabase,
    id,
  );

  if (fetchError || !prescription) {
    return {
      error: NextResponse.json({ error: "Receta no encontrada" }, { status: 404 }),
    };
  }

  if (prescription.doctor_id !== professional.id) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }

  return { user, supabase, prescription };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await authorizeAndLoad(request, id);
  if (result.error) return result.error;
  const { prescription } = result;

  return NextResponse.json({
    id: prescription.id,
    patient_id: prescription.patient_id,
    patient_email: prescription.patient_email,
    patient_full_name: prescription.patient_full_name,
    institution_id: prescription.institution_id,
    medications: prescription.medications,
    notes: prescription.notes,
    price_amount: prescription.price_amount,
    price_currency: prescription.price_currency,
    sent_at: prescription.sent_at,
    payment_status: prescription.payment_status,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await authorizeAndLoad(request, id);
  if (result.error) return result.error;
  const { user, supabase, prescription } = result;

  if (prescription.sent_at || prescription.payment_status !== "pending") {
    return NextResponse.json(
      { error: "No se puede editar una receta ya enviada o pagada" },
      { status: 409 },
    );
  }

  // authorizeAndLoad already rejected requests with no org_id, but that
  // narrowing doesn't survive crossing the function boundary — re-check
  // here so `orgId` below is typed as `string`, not `string | null`.
  const orgId = user.org_id;
  if (!orgId) {
    return NextResponse.json({ error: "org_id requerido" }, { status: 403 });
  }

  try {
    const {
      patientId,
      medications,
      institutionId,
      priceAmount,
      notes,
      patientEmail,
      patientFullName,
    } = await request.json();

    const hasRegisteredPatient = Boolean(patientId);
    const hasUnregisteredPatient = Boolean(patientEmail) && Boolean(patientFullName);

    if (
      !Array.isArray(medications) ||
      medications.length === 0 ||
      (!hasRegisteredPatient && !hasUnregisteredPatient)
    ) {
      return NextResponse.json(
        {
          error:
            "medications y (patientId o patientEmail+patientFullName) son requeridos",
        },
        { status: 400 },
      );
    }

    if (patientId) {
      const { data: patient } = await supabase
        .from("patients")
        .select("id")
        .eq("id", patientId)
        .eq("org_id", orgId)
        .maybeSingle();
      if (!patient) {
        return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
      }
    }

    // Re-snapshot the institution's letterhead fields, same as POST — an
    // edit may change which institution the receta is issued under.
    let institutionSnapshot: {
      name: string;
      city: string | null;
      address: string | null;
      extraInfo: string | null;
    } | null = null;
    if (institutionId) {
      const { data: institution } = await getInstitutionById(
        supabase,
        institutionId,
        orgId,
      );
      if (institution) {
        institutionSnapshot = {
          name: institution.name,
          city: institution.city,
          address: institution.address,
          extraInfo: institution.extra_info,
        };
      }
    }

    const { data: updated, error: updateError } = await updatePrescription(
      supabase,
      id,
      {
        patient_id: patientId || null,
        medications,
        institution_id: institutionId || null,
        institution_snapshot: institutionSnapshot,
        price_amount: typeof priceAmount === "number" ? priceAmount : null,
        patient_email: patientEmail || null,
        patient_full_name: patientFullName || null,
        notes: notes || null,
      },
    );

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message ?? "Error al actualizar receta" },
        { status: 500 },
      );
    }

    return NextResponse.json({ id: updated.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
