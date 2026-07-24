import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  ALLOWED_MIME,
  MAX_FILE_BYTES,
  ensureUploadsDir,
  sanitizeFileName,
} from "@/lib/clinic/storage";
import {
  newId,
  readDb,
  writeDb,
} from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import type { LocalDocument } from "@/lib/clinic/types";

function mapLocalDocument(doc: LocalDocument, accessToken?: string) {
  const q = new URLSearchParams({ id: doc.id, download: "1" });
  if (accessToken) q.set("token", accessToken);
  return {
    id: doc.id,
    patientId: doc.patientId,
    appointmentId: doc.appointmentId,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    uploadedAt: doc.uploadedAt,
    downloadUrl: `/api/clinic/documents?${q.toString()}`,
  };
}

export async function attachLocalDocument(opts: {
  appointmentId: string;
  patientId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<LocalDocument> {
  if (!ALLOWED_MIME.includes(opts.mimeType as (typeof ALLOWED_MIME)[number])) {
    throw new Error("Formato no permitido (PDF, JPG, PNG)");
  }
  if (opts.buffer.length > MAX_FILE_BYTES) {
    throw new Error("Archivo excede 10 MB");
  }

  const uploadsRoot = await ensureUploadsDir();
  const aptDir = path.join(uploadsRoot, opts.appointmentId);
  await fs.mkdir(aptDir, { recursive: true });

  const safeName = sanitizeFileName(opts.fileName);
  const storedName = `${Date.now()}-${safeName}`;
  const absPath = path.join(aptDir, storedName);
  await fs.writeFile(absPath, opts.buffer);

  const doc: LocalDocument = {
    id: newId("doc"),
    patientId: opts.patientId,
    appointmentId: opts.appointmentId,
    fileName: opts.fileName,
    filePath: path.join(opts.appointmentId, storedName),
    mimeType: opts.mimeType,
    uploadedAt: new Date().toISOString(),
    // Keep a copy in JSON so downloads still work if the file is cleaned up.
    inlineDataBase64: opts.buffer.toString("base64"),
  };

  await writeDb((draft) => {
    draft.documents.push(doc);
  });

  return doc;
}

async function resolveAppointmentByToken(token: string) {
  const db = await readDb();
  return db.appointments.find((a) => a.accessToken === token) ?? null;
}

async function canAccessAppointment(opts: {
  request: NextRequest;
  appointmentId: string;
  patientId: string;
  accessToken?: string | null;
}): Promise<boolean> {
  if (opts.accessToken) {
    const apt = await resolveAppointmentByToken(opts.accessToken);
    return !!apt && apt.id === opts.appointmentId;
  }
  const session = await getSessionFromRequest(opts.request);
  if (!session) return false;
  if (session.role === "patient") return session.userId === opts.patientId;
  if (session.role === "doctor") {
    const db = await readDb();
    const apt = db.appointments.find((a) => a.id === opts.appointmentId);
    return !!apt && apt.doctorId === session.userId;
  }
  return false;
}

export async function handleDocumentsGetLocal(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const download = searchParams.get("download") === "1";
  const patientId = searchParams.get("patientId");
  const appointmentId = searchParams.get("appointmentId");
  const accessToken = searchParams.get("token");

  const db = await readDb();

  if (id && download) {
    const doc = db.documents.find((d) => d.id === id);
    if (!doc) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }
    const allowed = await canAccessAppointment({
      request,
      appointmentId: doc.appointmentId,
      patientId: doc.patientId,
      accessToken,
    });
    if (!allowed) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    let buffer: Buffer | null = null;
    if (doc.inlineDataBase64) {
      buffer = Buffer.from(doc.inlineDataBase64, "base64");
    } else if (doc.filePath) {
      try {
        buffer = await fs.readFile(path.join(await ensureUploadsDir(), doc.filePath));
      } catch {
        buffer = null;
      }
    }
    if (!buffer) {
      return NextResponse.json({ error: "Archivo no disponible" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${sanitizeFileName(doc.fileName)}"`,
      },
    });
  }

  let docs = db.documents;
  if (accessToken) {
    const apt = await resolveAppointmentByToken(accessToken);
    if (!apt) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    docs = docs.filter((d) => d.appointmentId === apt.id);
    return NextResponse.json(docs.map((d) => mapLocalDocument(d, accessToken)));
  }
  if (appointmentId) {
    docs = docs.filter((d) => d.appointmentId === appointmentId);
  } else if (patientId) {
    docs = docs.filter((d) => d.patientId === patientId);
  } else {
    return NextResponse.json({ error: "Parámetro requerido" }, { status: 400 });
  }

  return NextResponse.json(docs.map((d) => mapLocalDocument(d)));
}

export async function handleDocumentsPostLocal(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const accessToken = formData.get("accessToken")?.toString();
  const appointmentIdParam = formData.get("appointmentId")?.toString();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return NextResponse.json(
      { error: "Formato no permitido (PDF, JPG, PNG)" },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Archivo excede 10 MB" }, { status: 400 });
  }

  const db = await readDb();
  let appointment =
    (accessToken
      ? db.appointments.find((a) => a.accessToken === accessToken)
      : null) ??
    (appointmentIdParam
      ? db.appointments.find((a) => a.id === appointmentIdParam)
      : null) ??
    null;

  if (!appointment) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  const allowed = await canAccessAppointment({
    request,
    appointmentId: appointment.id,
    patientId: appointment.patientId,
    accessToken: accessToken ?? null,
  });
  if (!allowed) {
    // Token alone is enough for waiting-room uploads (public link).
    if (!accessToken || appointment.accessToken !== accessToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  if (!["scheduled", "waiting", "in_consultation"].includes(appointment.status)) {
    return NextResponse.json(
      { error: "No se pueden subir archivos a este turno" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const doc = await attachLocalDocument({
    appointmentId: appointment.id,
    patientId: appointment.patientId,
    fileName: file.name,
    mimeType: file.type,
    buffer,
  });

  return NextResponse.json(mapLocalDocument(doc, accessToken ?? appointment.accessToken));
}

export async function handleDocumentsDeleteLocal(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const accessToken = searchParams.get("token");

  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  const db = await readDb();
  const doc = db.documents.find((d) => d.id === id);
  if (!doc) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  const apt = db.appointments.find((a) => a.id === doc.appointmentId);
  if (!apt) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  const allowed = await canAccessAppointment({
    request,
    appointmentId: apt.id,
    patientId: apt.patientId,
    accessToken,
  });
  // Patients can delete their own study via session or waiting-room token.
  if (!allowed) {
    if (!accessToken || apt.accessToken !== accessToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  if (!["scheduled", "waiting", "in_consultation"].includes(apt.status)) {
    return NextResponse.json(
      { error: "No se pueden eliminar archivos de este turno" },
      { status: 400 },
    );
  }

  await writeDb((draft) => {
    draft.documents = draft.documents.filter((d) => d.id !== id);
  });

  if (doc.filePath) {
    try {
      await fs.unlink(path.join(await ensureUploadsDir(), doc.filePath));
    } catch {
      /* best-effort */
    }
  }

  return NextResponse.json({ ok: true });
}
