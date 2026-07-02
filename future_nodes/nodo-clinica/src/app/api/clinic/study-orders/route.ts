import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, newId } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { attachPdfToClinicalRecord } from "@/lib/clinic/clinical-record-document";
import {
  doctorCanAccessPatient,
  doctorOwnsAppointment,
  forbidden,
  requireDoctorSession,
} from "@/lib/clinic/access-control";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    const { appointmentId, doctorId, patientId, studies, notes, pdfBase64, newStudyLabels } =
      await request.json();

    if (!doctorId || !patientId || !Array.isArray(studies) || studies.length === 0) {
      return NextResponse.json(
        { error: "doctorId, patientId y studies requeridos" },
        { status: 400 },
      );
    }

    if (!requireDoctorSession(session, doctorId)) {
      return forbidden("Solo el médico autenticado puede emitir órdenes");
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

    const studyList = studies.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n");
    const content = [
      "Estudios solicitados:",
      studyList,
      notes?.trim() ? `\nObservaciones:\n${notes.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const fileName = `orden-estudios-${patient.fullName.replace(/\s+/g, "-")}.pdf`;
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
      const doc = d.doctors.find((x) => x.id === doctorId);
      if (doc && Array.isArray(newStudyLabels) && newStudyLabels.length > 0) {
        const existing = new Set(doc.customStudyLabels ?? []);
        for (const label of newStudyLabels) {
          const trimmed = String(label).trim();
          if (trimmed) existing.add(trimmed);
        }
        doc.customStudyLabels = [...existing];
      }
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
      studies,
      notes,
      clinical_record_id: record.id,
      downloadUrl: `/api/clinic/clinical-records/pdf?id=${record.id}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
