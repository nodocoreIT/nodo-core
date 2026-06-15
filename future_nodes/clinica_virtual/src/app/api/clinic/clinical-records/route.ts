import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, newId } from "@/lib/clinic/local-db";

export async function POST(request: NextRequest) {
  try {
    const { patientId, doctorId, appointmentId, title, content, recordType } =
      await request.json();

    if (!patientId || !doctorId || !content?.trim()) {
      return NextResponse.json(
        { error: "patientId, doctorId y content requeridos" },
        { status: 400 }
      );
    }

    const db = await readDb();
    const patient = db.patients.find((p) => p.id === patientId);
    const doctor = db.doctors.find((d) => d.id === doctorId);
    if (!patient || !doctor) {
      return NextResponse.json({ error: "Paciente o médico no encontrado" }, { status: 404 });
    }

    const record = {
      id: newId("rec"),
      patientId,
      doctorId,
      title:
        title?.trim() ||
        `Informe clínico — ${new Date().toLocaleDateString("es-AR")} · ${doctor.fullName}`,
      content: content.trim(),
      recordType: recordType || "informe",
      createdAt: new Date().toISOString(),
    };

    await writeDb((d) => {
      d.clinicalRecords.push(record);
      if (appointmentId && d.clinicalNotes[appointmentId]) {
        d.clinicalNotes[appointmentId] = {
          ...d.clinicalNotes[appointmentId],
          content: content.trim(),
          updatedAt: new Date().toISOString(),
        };
      }
    });

    return NextResponse.json({
      id: record.id,
      patient_id: record.patientId,
      doctor_id: record.doctorId,
      record_type: record.recordType,
      title: record.title,
      content: record.content,
      created_at: record.createdAt,
      appointment_id: appointmentId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  if (!patientId) {
    return NextResponse.json({ error: "patientId requerido" }, { status: 400 });
  }

  const db = await readDb();
  const records = db.clinicalRecords
    .filter((r) => r.patientId === patientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((r) => ({
      id: r.id,
      patient_id: r.patientId,
      doctor_id: r.doctorId,
      record_type: r.recordType,
      title: r.title,
      content: r.content,
      created_at: r.createdAt,
      doctor: db.doctors.find((d) => d.id === r.doctorId)
        ? {
            full_name: db.doctors.find((d) => d.id === r.doctorId)!.fullName,
          }
        : undefined,
    }));

  return NextResponse.json(records);
}
