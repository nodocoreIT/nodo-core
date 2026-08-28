import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { appBaseUrl } from "@/lib/clinic/appointment-payment";
import { isMailConfigured } from "@/lib/mail";
import { sendPrescriptionMagicLinkEmail } from "@/lib/email/resend";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

/**
 * Fase 3 of "Recetas" — sends (or resends) the magic link for a standalone
 * receta. Generates a fresh access_token + token_expires_at every call, so
 * calling it again re-issues a new 30-day link (old one stops working —
 * matches the single-active-token model used for appointments).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accessToken: string }> },
) {
  // Named `accessToken` only to satisfy Next.js's sibling-dynamic-folder
  // naming rule (see `[accessToken]/pdf/route.ts`) — the value here is the
  // receta's `id`, not a patient access token.
  const { accessToken: id } = await params;

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  if (user.role !== "doctor" && user.role !== "medico") {
    return NextResponse.json(
      { error: "Debe iniciar sesión como médico" },
      { status: 401 },
    );
  }

  const professional = await resolveProfessional(authResult);
  if (!professional?.id) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  // The Fase 2 `prescriptions` columns (patient_email, patient_full_name,
  // access_token, etc) predate the generated Database type — same untyped
  // cast already used for this table elsewhere in Fase 2/3.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServiceClient()) as any;

  const { data: prescription, error: fetchError } = await supabase
    .from("prescriptions")
    .select("id, doctor_id, patient_email, patient_full_name")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !prescription) {
    return NextResponse.json({ error: "Receta no encontrada" }, { status: 404 });
  }

  if (prescription.doctor_id !== professional.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!prescription.patient_email) {
    return NextResponse.json(
      { error: "La receta no tiene un email de paciente asociado" },
      { status: 400 },
    );
  }

  const { data: doctorRow } = await supabase
    .from("professionals")
    .select("full_name")
    .eq("id", professional.id)
    .maybeSingle();

  const accessToken = crypto.randomUUID();
  const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const sentAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("prescriptions")
    .update({
      access_token: accessToken,
      token_expires_at: tokenExpiresAt,
      sent_at: sentAt,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "No se pudo actualizar la receta" },
      { status: 500 },
    );
  }

  const confirmUrl = `${appBaseUrl()}/paciente/receta/${accessToken}`;
  const doctorName = doctorRow?.full_name ?? "tu médico";

  if (isMailConfigured()) {
    sendPrescriptionMagicLinkEmail({
      patientEmail: prescription.patient_email,
      patientName: prescription.patient_full_name ?? "Paciente",
      doctorName,
      confirmUrl,
    }).catch((err) =>
      console.error("[prescriptions/send] email error", err),
    );
  } else {
    console.warn(
      "[prescriptions/send] SMTP not configured — magic link (dev only):",
      confirmUrl,
    );
  }

  return NextResponse.json({ ok: true });
}
