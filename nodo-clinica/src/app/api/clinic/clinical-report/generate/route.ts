// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { generateClinicalReport } from "@/lib/ai/gemini";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      dictation,
      transcription,
      clinicalNotes,
      patientName,
      doctorName,
      doctorSpecialty,
      doctorLicense,
    } = body;

    const source = [dictation, transcription, clinicalNotes]
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!source) {
      return NextResponse.json(
        { error: "Dictá o escribí el informe primero" },
        { status: 400 },
      );
    }

    if (!patientName || !doctorName) {
      return NextResponse.json(
        { error: "Datos del paciente y médico requeridos" },
        { status: 400 },
      );
    }

    const result = await generateClinicalReport({
      dictation: dictation || "",
      transcription,
      clinicalNotes,
      patientName,
      doctorName,
      doctorSpecialty,
      doctorLicense,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "No se pudo generar el informe. Reintentá en unos minutos." },
      { status: 500 },
    );
  }
}
