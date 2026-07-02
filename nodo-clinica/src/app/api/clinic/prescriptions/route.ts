import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, newId } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { attachPdfToClinicalRecord } from "@/lib/clinic/clinical-record-document";
import { formatPrescriptionRecordContent } from "@/lib/clinic/medication-catalog";
import {
  doctorCanAccessPatient,
  doctorOwnsAppointment,
  forbidden,
  requireDoctorSession,
} from "@/lib/clinic/access-control";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    const { appointmentId, doctorId, patientId, medications, pdfBase64 } =
      await request.json();

    if (!doctorId || !patientId || !Array.isArray(medications) || medications.length === 0) {
      return NextResponse.json(
        { error: "doctorId, patientId y medications requeridos" },
        { status: 400 },
      );
    }

    if (!requireDoctorSession(session, doctorId)) {
      return forbidden("Solo el médico autenticado puede emitir recetas");
    }

    const db = await readDb();
    if (!doctorCanAccessPatient(db, session.userId, patientId)) {
      return forbidden("Sin relación clínica con este paciente");
    }

    if (appointmentId && !doctorOwnsAppointment(db, session.userId, appointmentId)) {
      return forbidden("Turno no asignado a este médico");
    }

    const patient = db.patients.find((p) => p.id === patientId);
    const doctor = db.doctors.find((d) => d.id === doctorId);
    if (!patient || !doctor) {
      return NextResponse.json({ error: "Paciente o médico no encontrado" }, { status: 404 });
    }

    const content = formatPrescriptionRecordContent(medications);
    const fileName = `receta-${patient.fullName.replace(/\s+/g, "-")}.pdf`;
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
      if (pdfBase64) {
        attachPdfToClinicalRecord(d, record.id, {
          patientId,
          appointmentId,
          fileName,
          pdfBase64,
        });
      }
    });

    return NextResponse.json({
      id: record.id,
      appointment_id: appointmentId,
      medications,
      clinical_record_id: record.id,
      downloadUrl: `/api/clinic/clinical-records/pdf?id=${record.id}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
