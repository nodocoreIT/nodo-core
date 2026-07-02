import { promises as fs } from "fs";
import path from "path";

import { newId, writeDb, type LocalDocument } from "@/lib/clinic/local-db";
import {
  ensureUploadsDir,
  sanitizeFileName,
  MAX_FILE_BYTES,
  ALLOWED_MIME,
} from "@/lib/clinic/storage";

export async function attachDocumentToAppointment(
  appointmentId: string,
  patientId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer,
): Promise<LocalDocument> {
  if (!ALLOWED_MIME.includes(mimeType as (typeof ALLOWED_MIME)[number])) {
    throw new Error("Formato no permitido (PDF, JPG, PNG)");
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error("Archivo excede 10 MB");
  }

  await ensureUploadsDir();
  const safeName = sanitizeFileName(fileName);
  const storedName = `${Date.now()}-${safeName}`;
  const absDir = path.join(await ensureUploadsDir(), appointmentId);
  await fs.mkdir(absDir, { recursive: true });
  const absPath = path.join(absDir, storedName);
  await fs.writeFile(absPath, buffer);

  const doc: LocalDocument = {
    id: newId("doc"),
    patientId,
    appointmentId,
    fileName,
    filePath: absPath,
    mimeType,
    uploadedAt: new Date().toISOString(),
    ...(process.env.VERCEL === "1"
      ? { inlineDataBase64: buffer.toString("base64") }
      : {}),
  };

  await writeDb((d) => {
    d.documents.push(doc);
  });

  return doc;
}
