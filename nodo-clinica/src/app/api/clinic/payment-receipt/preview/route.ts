// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { validatePaymentReceipt } from "@/lib/ai/payment-receipt";
import { buildPaymentReceiptAudit } from "@/lib/clinic/payment-receipt-audit";
import { DEFAULT_AVAILABILITY } from "@/lib/clinic/schedule";

/** Previsualiza validación IA del comprobante antes de confirmar el turno. */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  if (user.role !== "patient") {
    return NextResponse.json({ error: "Debe iniciar sesión como paciente" }, { status: 401 });
  }

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

  // Get professional to find org_id
  const { data: professional } = await supabase
    .from("professionals")
    .select("org_id, full_name")
    .eq("id", doctorId)
    .maybeSingle();

  if (!professional) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const { data: officeSettings } = await supabase
    .from("office_settings")
    .select("payment, availability")
    .eq("org_id", professional.org_id)
    .maybeSingle();

  const payment = (officeSettings?.payment as Record<string, unknown>) ?? {};
  const availability = (officeSettings?.availability as { slotDurationMinutes?: number } | null) ?? DEFAULT_AVAILABILITY;
  const fee = typeof payment.consultationFee === "number" ? payment.consultationFee : 0;
  const currency = (payment.currency as string | undefined) ?? "ARS";

  const validation = await validatePaymentReceipt({
    imageBase64: receipt.dataBase64,
    mimeType: receipt.mimeType || "image/jpeg",
    fileName: receipt.fileName,
    doctorName: professional.full_name,
    doctorAlias: (payment.alias as string | undefined),
    doctorCbu: (payment.cbu as string | undefined),
    beneficiaryName: (payment.beneficiaryName as string | undefined),
    expectedAmount: fee,
    currency,
    appointmentDateIso: scheduledAt,
    slotDurationMinutes: (availability as { slotDurationMinutes?: number }).slotDurationMinutes,
  });

  const audit = buildPaymentReceiptAudit(validation, fee, currency);

  return NextResponse.json({ ...validation, audit });
}
