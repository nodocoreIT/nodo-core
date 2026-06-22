import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, newId } from "@/lib/clinic/local-db";
import { formatPrescriptionRecordContent } from "@/lib/clinic/medication-catalog";

export async function POST(request: NextRequest) {
  try {
    const { appointmentId, doctorId, patientId, medications } =
      await request.json();

    if (!doctorId || !patientId || !Array.isArray(medications) || medications.length === 0) {
      return NextResponse.json(
        { error: "doctorId, patientId y medications requeridos" },
        { status: 400 },
      );
    }

    const db = await readDb();
    const patient = db.patients.find((p) => p.id === patientId);
    const doctor = db.doctors.find((d) => d.id === doctorId);
    if (!patient || !doctor) {
      return NextResponse.json({ error: "Paciente o médico no encontrado" }, { status: 404 });
    }

    const content = formatPrescriptionRecordContent(medications);
    const record = {
      id: newId("rec"),
      patientId,
      doctorId,
      appointmentId: appointmentId || undefined,
      title: `Receta — ${patient.fullName} — ${new Date().toLocaleDateString("es-AR")}`,
      content,
      recordType: "receta",
      createdAt: new Date().toISOString(),
    };

    await writeDb((d) => {
      d.clinicalRecords.push(record);
    });

    return NextResponse.json({
      id: record.id,
      appointment_id: appointmentId,
      medications,
      clinical_record_id: record.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
