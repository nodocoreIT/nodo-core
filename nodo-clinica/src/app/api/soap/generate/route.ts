// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateSoapSummary } from "@/lib/ai/gemini";
import { isLocalMode } from "@/lib/clinic/config";

export async function POST(request: NextRequest) {
  try {
    const { appointmentId, transcription, clinicalNotes } =
      await request.json();

    if (!appointmentId) {
      return NextResponse.json(
        { error: "appointmentId requerido" },
        { status: 400 }
      );
    }

    const soap = await generateSoapSummary(transcription, clinicalNotes);

    if (isLocalMode()) {
      return NextResponse.json({
        id: appointmentId,
        appointment_id: appointmentId,
        ...soap,
        created_at: new Date().toISOString(),
      });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("soap_summaries")
      .upsert(
        {
          appointment_id: appointmentId,
          subjective: soap.subjective,
          objective: soap.objective,
          analysis: soap.analysis,
          plan: soap.plan,
        },
        { onConflict: "appointment_id" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
