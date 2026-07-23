import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { validatePaymentReceipt } from "@/lib/ai/payment-receipt";
import { buildPaymentReceiptAudit } from "@/lib/clinic/payment-receipt-audit";
import { getBookableProfessional } from "@/lib/clinic/db/professionals";
import { isLocalMode } from "@/lib/clinic/config";
import { readDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { DEFAULT_AVAILABILITY } from "@/lib/clinic/schedule";

/** Previsualiza validación IA del comprobante antes de confirmar el turno. */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { doctorId, scheduledAt, receipt } = body as {
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

  if (isLocalMode()) {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "patient") {
      return NextResponse.json(
        { error: "Debe iniciar sesión como paciente" },
        { status: 401 },
      );
    }

    const db = await readDb();
    const doctor = db.doctors.find((d) => d.id === doctorId);
    if (!doctor) {
      return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
    }

    const payment = doctor.payment ?? {};
    const availability = doctor.availability ?? DEFAULT_AVAILABILITY;
    const fee =
      typeof payment.consultationFee === "number" ? payment.consultationFee : 0;
    const currency = payment.currency ?? "ARS";

    const validation = await validatePaymentReceipt({
      imageBase64: receipt.dataBase64,
      mimeType: receipt.mimeType || "image/jpeg",
      fileName: receipt.fileName,
      doctorName: doctor.fullName,
      doctorAlias: payment.alias,
      doctorCbu: payment.cbu,
      beneficiaryName: payment.beneficiaryName,
      expectedAmount: fee,
      currency,
      appointmentDateIso: scheduledAt,
      slotDurationMinutes: availability.slotDurationMinutes,
    });

    const audit = buildPaymentReceiptAudit(validation, fee, currency);
    return NextResponse.json({ ...validation, audit });
  }

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (user.role !== "patient") {
    return NextResponse.json(
      { error: "Debe iniciar sesión como paciente" },
      { status: 401 },
    );
  }

  const bookable = await getBookableProfessional(doctorId);
  if (!bookable) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const { professional, officeSettings } = bookable;
  const payment = (officeSettings?.payment as Record<string, unknown>) ?? {};
  const availability =
    (officeSettings?.availability as { slotDurationMinutes?: number } | null) ??
    DEFAULT_AVAILABILITY;
  const fee = typeof payment.consultationFee === "number" ? payment.consultationFee : 0;
  const currency = (payment.currency as string | undefined) ?? "ARS";

  const validation = await validatePaymentReceipt({
    imageBase64: receipt.dataBase64,
    mimeType: receipt.mimeType || "image/jpeg",
    fileName: receipt.fileName,
    doctorName: professional.full_name,
    doctorAlias: payment.alias as string | undefined,
    doctorCbu: payment.cbu as string | undefined,
    beneficiaryName: payment.beneficiaryName as string | undefined,
    expectedAmount: fee,
    currency,
    appointmentDateIso: scheduledAt,
    slotDurationMinutes: availability.slotDurationMinutes,
  });

  const audit = buildPaymentReceiptAudit(validation, fee, currency);

  return NextResponse.json({ ...validation, audit });
}
