// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { appointmentId, doctorId, patientId, medications } =
      await request.json();

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("prescriptions")
      .insert({
        appointment_id: appointmentId,
        doctor_id: doctorId,
        patient_id: patientId,
        medications,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
