import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import {
  readDb,
} from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import {
  canAccessDocument,
  doctorCanAccessPatient,
  doctorOwnsAppointment,
  forbidden,
  requireDoctorSession,
  requirePatientSession,
  requireSession,
  unauthorized,
  findAppointmentByAccessToken,
} from "@/lib/clinic/access-control";
import {
  ALLOWED_MIME,
  MAX_FILE_BYTES,
} from "@/lib/clinic/storage";
import { attachDocumentToAppointment } from "@/lib/clinic/appointment-documents";
import { markTransferReceiptPendingReview } from "@/lib/clinic/transfer-receipt-pending";

function mapDocument(
  doc: {
    id: string;
    patientId: string;
    appointmentId: string;
    fileName: string;
    mimeType: string;
    uploadedAt: string;
  },
  extra?: { doctorName?: string; scheduledAt?: string }
) {
  return {
    id: doc.id,
    patientId: doc.patientId,
    appointmentId: doc.appointmentId,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    uploadedAt: doc.uploadedAt,
    downloadUrl: `/api/clinic/documents?id=${doc.id}&download=1`,
    ...extra,
  };
}

export async function GET(request: NextRequest) {
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

    const session = await getSessionFromRequest(request);
    if (!canAccessDocument(db, doc, session, accessToken)) {
      return forbidden("No autorizado para descargar este archivo");
    }

    if (doc.inlineDataBase64) {
      const buffer = Buffer.from(doc.inlineDataBase64, "base64");
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": doc.mimeType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    try {
      const buffer = await fs.readFile(doc.filePath);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": doc.mimeType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch {
      return NextResponse.json({ error: "Archivo no disponible" }, { status: 404 });
    }
  }

  let docs = db.documents;
  const session = await getSessionFromRequest(request);

  if (accessToken) {
    const apt = findAppointmentByAccessToken(db, accessToken);
    if (!apt) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    docs = docs.filter((d) => d.appointmentId === apt.id);
  } else if (appointmentId) {
    const apt = db.appointments.find((a) => a.id === appointmentId);
    if (!apt) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    if (!requireSession(session)) {
      return unauthorized();
    }
    if (session.role === "patient" && session.userId !== apt.patientId) {
      return forbidden();
    }
    if (
      session.role === "doctor" &&
      !doctorOwnsAppointment(db, session.userId, appointmentId)
    ) {
      return forbidden();
    }
    docs = docs.filter((d) => d.appointmentId === appointmentId);
  } else if (patientId) {
    if (!requireSession(session)) {
      return unauthorized();
    }
    if (session.role === "patient" && session.userId !== patientId) {
      return forbidden();
    }
    if (
      session.role === "doctor" &&
      !doctorCanAccessPatient(db, session.userId, patientId)
    ) {
      return forbidden();
    }
    docs = docs.filter((d) => d.patientId === patientId);
  } else {
    return NextResponse.json({ error: "Parámetro requerido" }, { status: 400 });
  }

  const mapped = docs
    .sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )
    .map((doc) => {
      const apt = db.appointments.find((a) => a.id === doc.appointmentId);
      const doctor = apt
        ? db.doctors.find((d) => d.id === apt.doctorId)
        : undefined;
      return mapDocument(doc, {
        doctorName: doctor?.fullName,
        scheduledAt: apt?.scheduledAt,
      });
    });

  return NextResponse.json(mapped);
}

export async function POST(request: NextRequest) {
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
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Archivo excede 10 MB" }, { status: 400 });
  }

  const db = await readDb();
  let appointment = accessToken
    ? db.appointments.find((a) => a.accessToken === accessToken)
    : appointmentIdParam
      ? db.appointments.find((a) => a.id === appointmentIdParam)
      : undefined;

  if (!appointment && accessToken) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  if (!appointment) {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "patient") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (appointmentIdParam) {
      appointment = db.appointments.find(
        (a) => a.id === appointmentIdParam && a.patientId === session.userId
      );
    }
  }

  if (!appointment) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  if (
    !["scheduled", "waiting", "in_consultation"].includes(appointment.status)
  ) {
    return NextResponse.json(
      { error: "No se pueden subir archivos a este turno" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const doc = await attachDocumentToAppointment(
    appointment.id,
    appointment.patientId,
    file.name,
    file.type,
    buffer,
  );

  if (appointment.paymentStatus === "pending") {
    await markTransferReceiptPendingReview(appointment, {
      fileName: file.name,
    });
  }

  return NextResponse.json(mapDocument(doc));
}
