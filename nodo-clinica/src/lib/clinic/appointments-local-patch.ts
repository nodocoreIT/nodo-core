import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { doctorOwnsAppointment } from "@/lib/clinic/access-control";

const DOCTOR_ROLES = new Set(["doctor", "admin", "super_admin", "medico", "agent"]);

/** PATCH /api/clinic/appointments en CLINIC_MODE=local. */
export async function handleAppointmentsPatchLocal(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || !DOCTOR_ROLES.has(session.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { appointmentId, action } = body as {
    appointmentId?: string;
    action?: string;
  };

  if (!appointmentId || !action) {
    return NextResponse.json(
      { error: "appointmentId y action requeridos" },
      { status: 400 },
    );
  }

  if (action === "doctorConfirmPayment" || action === "doctorRejectPayment") {
    const db = await readDb();
    if (!doctorOwnsAppointment(db, session.userId, appointmentId)) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }

    const now = new Date().toISOString();
    let result: (typeof db.appointments)[number] | null = null;

    await writeDb((draft) => {
      const apt = draft.appointments.find((a) => a.id === appointmentId);
      if (!apt) return;
      if (action === "doctorConfirmPayment") {
        apt.paymentStatus = "confirmed";
        apt.paymentConfirmedAt = now;
        if (apt.status === "cancelled") apt.status = "scheduled";
      } else {
        apt.paymentStatus = "pending";
        apt.paymentConfirmedAt = undefined;
        apt.status = "cancelled";
      }
      apt.updatedAt = now;
      result = { ...apt };
    });

    if (!result) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: `Acción no soportada en local: ${action}` },
    { status: 400 },
  );
}
