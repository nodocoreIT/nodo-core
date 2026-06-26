// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendAppointmentConfirmationEmail } from "@/lib/email/resend";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export async function POST(request: NextRequest) {
  try {
    const {
      patientEmail,
      patientName,
      doctorId,
      doctorName,
      scheduledAt,
      patientProfileId,
    } = await request.json();

    const supabase = await createServiceClient();

    let patientId: string;

    const { data: existingPatient } = await supabase
      .from("patients")
      .select("id")
      .eq("profile_id", patientProfileId)
      .maybeSingle();

    if (existingPatient?.id) {
      patientId = existingPatient.id;
    } else {
      const { data: newPatient, error: patientError } = await supabase
        .from("patients")
        .insert({ profile_id: patientProfileId })
        .select("id")
        .single();

      if (patientError || !newPatient) {
        return NextResponse.json(
          { error: "Error al crear paciente" },
          { status: 500 }
        );
      }
      patientId = newPatient.id;
    }

    const { count } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctorId)
      .gte("scheduled_at", new Date().toISOString().split("T")[0]);

    const queuePosition = (count || 0) + 1;
    const jitsiRoomId = `clinica-${doctorId.slice(0, 8)}-${Date.now()}`;
    const tokenExpires = new Date(scheduledAt);
    tokenExpires.setHours(tokenExpires.getHours() + 2);

    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert({
        patient_id: patientId,
        doctor_id: doctorId,
        scheduled_at: scheduledAt,
        status: "scheduled",
        queue_position: queuePosition,
        jitsi_room_id: jitsiRoomId,
        token_expires_at: tokenExpires.toISOString(),
      })
      .select("access_token")
      .single();

    if (error || !appointment) {
      return NextResponse.json({ error: error?.message }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const waitingRoomUrl = `${baseUrl}/paciente/sala/${appointment.access_token}`;

    await sendAppointmentConfirmationEmail({
      patientEmail,
      patientName,
      doctorName,
      scheduledAt: format(new Date(scheduledAt), "dd 'de' MMMM 'yyyy' 'a las' HH:mm 'hs'", {
        locale: es,
      }),
      waitingRoomUrl,
    });

    return NextResponse.json({
      appointmentId: appointment.access_token,
      waitingRoomUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
