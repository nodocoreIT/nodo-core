import { NextRequest, NextResponse } from "next/server";
import { isLocalMode } from "@/lib/clinic/config";
import { readDb } from "@/lib/clinic/local-db";
import { isPaymentConfirmed } from "@/lib/clinic/payment";
import { getSessionFromRequest } from "@/lib/clinic/session";
import {
  buildCheckoutForAppointment,
  type CheckoutOptions,
} from "@/lib/mercadopago/checkout";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { getAppointmentById } from "@/lib/clinic/db/appointments";
import { resolveAppointmentByAccessToken } from "@/lib/clinic/appointment-token-auth";

async function checkoutOrPaidResponse(
  row: Record<string, unknown>,
  returnTo: CheckoutOptions["returnTo"],
) {
  const paymentStatus = row.payment_status as string | null;
  if (paymentStatus === "confirmed" || paymentStatus === "waived") {
    return NextResponse.json({
      paid: true,
      waitingRoomUrl: `/paciente/sala/${row.access_token}`,
    });
  }

  const result = await buildCheckoutForAppointment(row.id as string, { returnTo });
  if (!result) {
    return NextResponse.json(
      { error: "Mercado Pago no configurado para este médico" },
      { status: 400 },
    );
  }

  return NextResponse.json(result);
}

/** Obtiene o regenera URL de checkout MP para un turno pendiente. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accessTokenParam = searchParams.get("accessToken");
  const appointmentId = searchParams.get("appointmentId");
  // Set by the client when this WaitingRoom is rendered inside the portal's
  // modal (not the standalone /paciente/sala page) — see waiting-room.tsx's
  // `embedded` flag — so MP sends the patient back into that same modal
  // instead of navigating them out of the portal.
  const returnTo = searchParams.get("returnTo") === "portal" ? "portal" : "sala";

  if (isLocalMode()) {
    const session = await getSessionFromRequest(request);
    const db = await readDb();

    const apt = accessTokenParam
      ? db.appointments.find((a) => a.accessToken === accessTokenParam)
      : appointmentId
        ? db.appointments.find((a) => a.id === appointmentId)
        : undefined;

    if (!apt) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }

    if (session?.role === "patient" && session.userId !== apt.patientId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (isPaymentConfirmed(apt)) {
      return NextResponse.json({
        paid: true,
        waitingRoomUrl: `/paciente/sala/${apt.accessToken}`,
      });
    }

    const result = await buildCheckoutForAppointment(apt.id, { returnTo });
    if (!result) {
      return NextResponse.json(
        { error: "Mercado Pago no configurado para este médico" },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  }

  // A valid, non-expired access_token is sufficient credential — no login
  // required (magic-link style), scoped to exactly this one appointment.
  if (accessTokenParam) {
    const apt = await resolveAppointmentByAccessToken(accessTokenParam);
    if (!apt) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    return checkoutOrPaidResponse(apt as Record<string, unknown>, returnTo);
  }

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const { data: apt } = appointmentId
    ? await getAppointmentById(supabase, appointmentId, "")
    : { data: null };

  if (!apt) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  const row = apt as Record<string, unknown>;

  if (auth.user.role === "patient") {
    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("profile_id", auth.user.id)
      .maybeSingle();

    if (!patient || patient.id !== row.patient_id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  return checkoutOrPaidResponse(row, returnTo);
}
