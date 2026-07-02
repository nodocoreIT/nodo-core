export type TimelineItemKind =
  | "consulta"
  | "documento"
  | "receta"
  | "estudio"
  | "informe"
  | "soap"
  | "evolucion";

export interface PatientTimelineItem {
  id: string;
  kind: TimelineItemKind;
  date: string;
  title: string;
  subtitle?: string;
  content?: string;
  doctorName?: string;
  appointmentId?: string;
  downloadUrl?: string;
  fileName?: string;
  status?: string;
}

export interface TimelineSourceAppointment {
  id: string;
  scheduledAt: string;
  status: string;
  doctor: { fullName: string; specialty: string } | null;
  documents: {
    id: string;
    fileName: string;
    uploadedAt: string;
    downloadUrl: string;
  }[];
  clinicalNote: string | null;
}

export interface TimelineSourceRecord {
  id: string;
  title: string;
  content: string;
  recordType: string;
  createdAt: string;
  appointmentId?: string;
  doctorName?: string;
  documentId?: string;
}

const RECORD_KIND_MAP: Record<string, TimelineItemKind> = {
  receta: "receta",
  estudio: "estudio",
  informe: "informe",
  soap: "soap",
  consultation: "evolucion",
  evolucion: "evolucion",
};

export function recordTypeToKind(recordType: string): TimelineItemKind {
  return RECORD_KIND_MAP[recordType] ?? "evolucion";
}

const KIND_LABELS: Record<TimelineItemKind, string> = {
  consulta: "Consulta",
  documento: "Estudio subido",
  receta: "Receta",
  estudio: "Orden de estudios",
  informe: "Informe médico",
  soap: "Resumen SOAP",
  evolucion: "Evolución",
};

export function timelineKindLabel(kind: TimelineItemKind): string {
  return KIND_LABELS[kind];
}

export function buildPatientTimeline(
  appointments: TimelineSourceAppointment[],
  records: TimelineSourceRecord[],
): PatientTimelineItem[] {
  const items: PatientTimelineItem[] = [];
  const recordAppointmentIds = new Set(
    records.map((r) => r.appointmentId).filter(Boolean) as string[],
  );

  for (const apt of appointments) {
    const doctorLabel = apt.doctor?.fullName;
    const specialty = apt.doctor?.specialty;

    items.push({
      id: `apt-${apt.id}`,
      kind: "consulta",
      date: apt.scheduledAt,
      title: `Consulta con Dr/a. ${doctorLabel ?? "médico"}`,
      subtitle: specialty,
      doctorName: doctorLabel,
      appointmentId: apt.id,
      status: apt.status,
      content:
        apt.status === "completed" && apt.clinicalNote && !recordAppointmentIds.has(apt.id)
          ? apt.clinicalNote
          : undefined,
    });

    for (const doc of apt.documents) {
      items.push({
        id: `doc-${doc.id}`,
        kind: "documento",
        date: doc.uploadedAt,
        title: doc.fileName,
        subtitle: doctorLabel ? `Turno con Dr/a. ${doctorLabel}` : undefined,
        doctorName: doctorLabel,
        appointmentId: apt.id,
        downloadUrl: doc.downloadUrl,
        fileName: doc.fileName,
      });
    }
  }

  for (const rec of records) {
    const kind = recordTypeToKind(rec.recordType);
    items.push({
      id: `rec-${rec.id}`,
      kind,
      date: rec.createdAt,
      title: rec.title,
      content: rec.content,
      doctorName: rec.doctorName,
      appointmentId: rec.appointmentId,
      downloadUrl: rec.documentId
        ? `/api/clinic/documents?id=${rec.documentId}&download=1`
        : kind === "receta" || kind === "estudio"
          ? `/api/clinic/clinical-records/pdf?id=${rec.id}`
          : undefined,
      fileName:
        kind === "receta"
          ? "receta-medica.pdf"
          : kind === "estudio"
            ? "orden-estudios.pdf"
            : undefined,
    });
  }

  return items.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}
