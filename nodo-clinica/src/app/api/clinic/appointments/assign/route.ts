import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { isLocalMode } from "@/lib/clinic/config";
import { doctorAssignAppointments } from "@/lib/clinic/doctor-assign-appointment";
import { handleAppointmentsAssignLocal } from "@/lib/clinic/appointments-local-assign";

const DOCTOR_ROLES = new Set(["admin", "super_admin", "medico", "agent", "doctor"]);

/** POST /api/clinic/appointments/assign — médico asigna turnos a un paciente. */
export async function POST(request: NextRequest) {
  if (isLocalMode()) {
    return handleAppointmentsAssignLocal(request);
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  if (!DOCTOR_ROLES.has(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const professional = await resolveProfessional(authResult);
  if (!professional) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const {
    patientId,
    patientEmail,
    scheduledAt,
    scheduledAtList,
    intakeReason,
  } = body as {
    patientId?: string;
    patientEmail?: string;
    scheduledAt?: string;
    scheduledAtList?: string[];
    intakeReason?: string;
  };

  if (!patientId) {
    return NextResponse.json({ error: "Paciente requerido" }, { status: 400 });
  }

  const slots = [
    ...(Array.isArray(scheduledAtList) ? scheduledAtList : []),
    ...(scheduledAt ? [scheduledAt] : []),
  ];

  const svc = await createServiceClient();

  try {
    const result = await doctorAssignAppointments({
      supabase: svc,
      doctorId: professional.id,
      orgId: user.org_id ?? "",
      patientId,
      patientEmail,
      scheduledAtList: slots,
      intakeReason,
    });

    return NextResponse.json({
      ok: true,
      appointments: result.created,
      patientEmail: result.patientEmail,
      patientName: result.patientName,
      count: result.created.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al asignar turno";
    const status = message.includes("reservado") || message.includes("activo") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
