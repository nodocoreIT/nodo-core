import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/clinic/local-db";
import { validatePaymentReceipt } from "@/lib/ai/payment-receipt";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { buildPaymentReceiptAudit } from "@/lib/clinic/payment-receipt-audit";
import { DEFAULT_AVAILABILITY } from "@/lib/clinic/schedule";

/** Previsualiza validación IA del comprobante antes de confirmar el turno. */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "patient") {
    return NextResponse.json({ error: "Debe iniciar sesión como paciente" }, { status: 401 });
  }

  const body = await request.json();
  const {
    doctorId,
    scheduledAt,
    receipt,
  } = body as {
    doctorId?: string;
    scheduledAt?: string;
    receipt?: { fileName?: string; mimeType?: string; dataBase64?: string };
  };

  if (!doctorId || !scheduledAt || !receipt?.dataBase64?.trim()) {
    return NextResponse.json(
      { error: "doctorId, scheduledAt y comprobante requeridos" },
      { status: 400 },
    );
  }

  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const fee = doctor.payment?.consultationFee ?? 0;
  const currency = doctor.payment?.currency ?? "ARS";
  const availability = doctor.availability ?? DEFAULT_AVAILABILITY;

  const validation = await validatePaymentReceipt({
    imageBase64: receipt.dataBase64,
    mimeType: receipt.mimeType || "image/jpeg",
    fileName: receipt.fileName,
    doctorName: doctor.fullName,
    doctorAlias: doctor.payment?.alias,
    doctorCbu: doctor.payment?.cbu,
    beneficiaryName: doctor.payment?.beneficiaryName,
    expectedAmount: fee,
    currency,
    appointmentDateIso: scheduledAt,
    slotDurationMinutes: availability.slotDurationMinutes,
  });

  const audit = buildPaymentReceiptAudit(validation, fee, currency);

  return NextResponse.json({
    ...validation,
    audit,
  });
}
