export type SessionClinicalDocumentType = "receta" | "estudio";

export interface SessionClinicalDocument {
  id: string;
  recordType: SessionClinicalDocumentType;
  title: string;
  createdAt: string;
  pdfUrl: string;
}

const SESSION_RECORD_TYPES = new Set<SessionClinicalDocumentType>([
  "receta",
  "estudio",
]);

export function isSessionClinicalRecordType(
  value: string,
): value is SessionClinicalDocumentType {
  return SESSION_RECORD_TYPES.has(value as SessionClinicalDocumentType);
}

export function buildSessionClinicalPdfUrl(
  recordId: string,
  accessToken?: string,
): string {
  const params = new URLSearchParams({ id: recordId });
  if (accessToken) {
    params.set("token", accessToken);
  }
  return `/api/clinic/clinical-records/pdf?${params.toString()}`;
}

export function mapSessionClinicalDocuments(
  records: Array<{
    id: string;
    record_type?: string;
    recordType?: string;
    title: string;
    created_at?: string;
    createdAt?: string;
  }>,
  accessToken: string,
): SessionClinicalDocument[] {
  return records
    .filter((record) =>
      isSessionClinicalRecordType(record.record_type ?? record.recordType ?? ""),
    )
    .map((record) => {
      const recordType = (record.record_type ??
        record.recordType) as SessionClinicalDocumentType;
      return {
        id: record.id,
        recordType,
        title: record.title,
        createdAt: record.created_at ?? record.createdAt ?? new Date().toISOString(),
        pdfUrl: buildSessionClinicalPdfUrl(record.id, accessToken),
      };
    })
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
}
