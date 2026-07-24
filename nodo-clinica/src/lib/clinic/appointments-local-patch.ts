import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { doctorOwnsAppointment } from "@/lib/clinic/access-control";
import type { AppointmentStatus, LocalAppointment } from "@/lib/clinic/types";

const DOCTOR_ROLES = new Set(["doctor", "admin", "super_admin", "medico", "agent"]);

const PATIENT_STATUSES = new Set<AppointmentStatus>(["waiting"]);
const DOCTOR_STATUSES = new Set<AppointmentStatus>([
  "scheduled",
  "waiting",
  "in_consultation",
  "completed",
  "cancelled",
]);

function findByToken(apts: LocalAppointment[], token: string) {
  return apts.find((a) => a.accessToken === token) ?? null;
}

/** PATCH /api/clinic/appointments en CLINIC_MODE=local. */
export async function handleAppointmentsPatchLocal(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  const body = await request.json();
  const {
    appointmentId,
    status,
    accessToken,
    action,
    intakeReason,
  } = body as {
    appointmentId?: string;
    status?: AppointmentStatus;
    accessToken?: string;
    action?: string;
    intakeReason?: string;
  };

  // ── Token-based patient actions (waiting room / turnos) ─────────────────

  if (action === "saveIntake" && accessToken) {
    let result: LocalAppointment | null = null;
    await writeDb((draft) => {
      const apt = findByToken(draft.appointments, accessToken);
      if (!apt) return;
      apt.intakeReason = String(intakeReason ?? "").slice(0, 4000);
      apt.updatedAt = new Date().toISOString();
      result = { ...apt };
    });
    if (!result) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    return NextResponse.json(result);
  }

  if (action === "confirmPayment" && accessToken) {
    let result: LocalAppointment | null = null;
    const now = new Date().toISOString();
    await writeDb((draft) => {
      const apt = findByToken(draft.appointments, accessToken);
      if (!apt) return;
      if (apt.paymentStatus === "confirmed" || apt.paymentStatus === "waived") {
        result = { ...apt };
        return;
      }
      apt.paymentStatus = "confirmed";
      apt.paymentConfirmedAt = now;
      apt.updatedAt = now;
      result = { ...apt };
    });
    if (!result) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    return NextResponse.json(result);
  }

  if (action === "patientCancelAppointment" && accessToken) {
    let result: LocalAppointment | null = null;
    await writeDb((draft) => {
      const apt = findByToken(draft.appointments, accessToken);
      if (!apt) return;
      if (apt.status !== "scheduled" || apt.paymentStatus !== "pending") return;
      apt.status = "cancelled";
      apt.updatedAt = new Date().toISOString();
      result = { ...apt };
    });
    if (!result) {
      return NextResponse.json(
        { error: "Este turno ya no se puede cancelar desde acá" },
        { status: 400 },
      );
    }
    return NextResponse.json(result);
  }

  if (
    (action === "patientRemoveAppointment" ||
      action === "patientDeleteCancelledAppointment") &&
    accessToken
  ) {
    const db = await readDb();
    const apt = findByToken(db.appointments, accessToken);
    if (!apt) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    if (
      action === "patientDeleteCancelledAppointment" &&
      apt.status !== "cancelled"
    ) {
      return NextResponse.json(
        { error: "Solo se pueden eliminar turnos cancelados" },
        { status: 400 },
      );
    }
    if (session?.role === "patient" && apt.patientId !== session.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    await writeDb((draft) => {
      draft.appointments = draft.appointments.filter((a) => a.id !== apt.id);
      draft.documents = draft.documents.filter((d) => d.appointmentId !== apt.id);
    });
    return NextResponse.json({ ok: true });
  }

  // ── Doctor payment review ───────────────────────────────────────────────

  if (action === "doctorConfirmPayment" || action === "doctorRejectPayment") {
    if (!session || !DOCTOR_ROLES.has(session.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (!appointmentId) {
      return NextResponse.json(
        { error: "appointmentId requerido" },
        { status: 400 },
      );
    }

    const db = await readDb();
    if (!doctorOwnsAppointment(db, session.userId, appointmentId)) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }

    const now = new Date().toISOString();
    let result: LocalAppointment | null = null;

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

  // ── Generic status update (patient → waiting, doctor → consultation…) ───

  if (status && appointmentId) {
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const db = await readDb();
    const apt = db.appointments.find((a) => a.id === appointmentId);
    if (!apt) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }

    if (session.role === "patient") {
      if (apt.patientId !== session.userId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      if (!PATIENT_STATUSES.has(status)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    } else if (DOCTOR_ROLES.has(session.role)) {
      if (!doctorOwnsAppointment(db, session.userId, appointmentId)) {
        return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
      }
      if (!DOCTOR_STATUSES.has(status)) {
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    let result: LocalAppointment | null = null;
    await writeDb((draft) => {
      const row = draft.appointments.find((a) => a.id === appointmentId);
      if (!row) return;
      row.status = status;
      row.updatedAt = new Date().toISOString();
      result = { ...row };
    });

    if (!result) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: action ? `Acción no soportada en local: ${action}` : "Parámetros inválidos" },
    { status: 400 },
  );
}
