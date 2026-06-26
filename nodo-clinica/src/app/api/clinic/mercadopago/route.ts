import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { buildCheckoutForAppointment } from "@/lib/mercadopago/checkout";
import { createClient } from "@/lib/supabase/server";
import { getAppointmentByToken, getAppointmentById } from "@/lib/clinic/db/appointments";

/** Obtiene o regenera URL de checkout MP para un turno pendiente. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accessTokenParam = searchParams.get("accessToken");
  const appointmentId = searchParams.get("appointmentId");

  // Allow unauthenticated access when a patient uses accessToken (waiting room)
  const auth = await requireAuth(request);
  const supabase = auth instanceof NextResponse
    ? await createClient()
    : auth.supabase;

  const { data: apt } = accessTokenParam
    ? await getAppointmentByToken(supabase, accessTokenParam)
    : appointmentId
      ? await getAppointmentById(supabase, appointmentId, "")
      : { data: null };

  if (!apt) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  const row = apt as Record<string, unknown>;

  // If patient is authenticated, verify ownership
  if (!(auth instanceof NextResponse) && auth.user.role === "patient") {
    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("profile_id", auth.user.id)
      .maybeSingle();

    if (!patient || patient.id !== row.patient_id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const paymentStatus = row.payment_status as string | null;
  if (paymentStatus === "confirmed" || paymentStatus === "waived") {
    return NextResponse.json({
      paid: true,
      waitingRoomUrl: `/paciente/sala/${row.access_token}`,
    });
  }

  const result = await buildCheckoutForAppointment(row.id as string);
  if (!result) {
    return NextResponse.json(
      { error: "Mercado Pago no configurado para este médico" },
      { status: 400 },
    );
  }

  return NextResponse.json(result);
}
