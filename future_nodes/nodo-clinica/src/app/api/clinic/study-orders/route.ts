import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, newId } from "@/lib/clinic/local-db";

export async function POST(request: NextRequest) {
  try {
    const { appointmentId, doctorId, patientId, studies, notes } =
      await request.json();

    if (!doctorId || !patientId || !Array.isArray(studies) || studies.length === 0) {
      return NextResponse.json(
        { error: "doctorId, patientId y studies requeridos" },
        { status: 400 },
      );
    }

    const db = await readDb();
    const patient = db.patients.find((p) => p.id === patientId);
    const doctor = db.doctors.find((d) => d.id === doctorId);
    if (!patient || !doctor) {
      return NextResponse.json({ error: "Paciente o médico no encontrado" }, { status: 404 });
    }

    const studyList = studies.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n");
    const content = [
      "Estudios solicitados:",
      studyList,
      notes?.trim() ? `\nObservaciones:\n${notes.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const record = {
      id: newId("rec"),
      patientId,
      doctorId,
      appointmentId: appointmentId || undefined,
      title: `Orden de estudios — ${patient.fullName} — ${new Date().toLocaleDateString("es-AR")}`,
      content,
      recordType: "estudio",
      createdAt: new Date().toISOString(),
    };

    await writeDb((d) => {
      d.clinicalRecords.push(record);
    });

    return NextResponse.json({
      id: record.id,
      appointment_id: appointmentId,
      studies,
      notes,
      clinical_record_id: record.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
