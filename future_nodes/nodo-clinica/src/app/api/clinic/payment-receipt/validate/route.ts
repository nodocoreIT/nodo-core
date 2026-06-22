import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { readDb, writeDb } from "@/lib/clinic/local-db";
import { validatePaymentReceipt } from "@/lib/ai/payment-receipt";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { isStrictPaymentValidation } from "@/lib/clinic/payment-validation";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { accessToken, documentId } = body as {
    accessToken?: string;
    documentId?: string;
  };

  if (!accessToken || !documentId) {
    return NextResponse.json(
      { error: "accessToken y documentId requeridos" },
      { status: 400 },
    );
  }

  const session = await getSessionFromRequest(request);
  const db = await readDb();
  const apt = db.appointments.find((a) => a.accessToken === accessToken);
  if (!apt) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  if (
    session?.role === "patient" &&
    session.userId !== apt.patientId
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const doc = db.documents.find(
    (d) => d.id === documentId && d.appointmentId === apt.id,
  );
  if (!doc) {
    return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 });
  }

  const doctor = db.doctors.find((d) => d.id === apt.doctorId);
  if (!doctor) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  let imageBase64: string;
  try {
    const buffer = await fs.readFile(doc.filePath);
    imageBase64 = buffer.toString("base64");
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer el archivo del comprobante" },
      { status: 500 },
    );
  }

  const fee = doctor.payment?.consultationFee ?? 0;
  const availability = doctor.availability;
  const result = await validatePaymentReceipt({
    imageBase64,
    mimeType: doc.mimeType,
    fileName: doc.fileName,
    doctorName: doctor.fullName,
    doctorAlias: doctor.payment?.alias,
    doctorCbu: doctor.payment?.cbu,
    expectedAmount: fee,
    currency: doctor.payment?.currency ?? "ARS",
    appointmentDateIso: apt.scheduledAt,
    slotDurationMinutes: availability?.slotDurationMinutes,
  });

  if (result.valid) {
    const now = new Date().toISOString();
    await writeDb((d) => {
      const target = d.appointments.find((a) => a.id === apt.id);
      if (!target) return;
      target.paymentStatus = "confirmed";
      target.paymentConfirmedAt = now;
      target.updatedAt = now;
    });
  }

  return NextResponse.json(result);
}
