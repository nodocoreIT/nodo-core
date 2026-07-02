import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validatePaymentReceipt } from "@/lib/ai/payment-receipt";
import { buildPaymentReceiptAudit } from "@/lib/clinic/payment-receipt-audit";
import { markTransferReceiptPendingReview } from "@/lib/clinic/transfer-receipt-pending";
import { confirmAppointmentPaymentAndNotify } from "@/lib/clinic/appointment-payment";
import { requireAuth } from "@/lib/supabase/auth-guard";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { accessToken: aptAccessToken, documentId } = body as {
    accessToken?: string;
    documentId?: string;
  };

  if (!aptAccessToken || !documentId) {
    return NextResponse.json(
      { error: "accessToken y documentId requeridos" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data: apt } = await supabase
    .from("appointments")
    .select("*")
    .eq("access_token", aptAccessToken)
    .maybeSingle();

  if (!apt) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  const row = apt as Record<string, unknown>;

  // Optionally verify patient ownership
  const auth = await requireAuth(request);
  if (!(auth instanceof NextResponse) && auth.user.role === "patient") {
    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("profile_id", auth.user.id)
      .maybeSingle();
    if (!patient || patient.id !== row.patient_id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const { data: doc } = await supabase
    .from("patient_documents")
    .select("*")
    .eq("id", documentId)
    .eq("appointment_id", row.id as string)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 });
  }

  const docRow = doc as Record<string, unknown>;

  const { data: officeSettings } = await supabase
    .from("office_settings")
    .select("payment, availability")
    .eq("org_id", row.org_id as string)
    .maybeSingle();

  const { data: professional } = await supabase
    .from("professionals")
    .select("full_name")
    .eq("id", row.doctor_id as string)
    .maybeSingle();

  const payment = (officeSettings?.payment as Record<string, unknown>) ?? {};
  const availability = officeSettings?.availability as { slotDurationMinutes?: number } | null;

  // Get the document data from Supabase Storage
  let imageBase64: string;
  const filePath = docRow.file_path as string;
  if (filePath) {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("patient-documents")
      .download(filePath);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: "No se pudo leer el archivo del comprobante" },
        { status: 500 },
      );
    }
    const buffer = Buffer.from(await fileData.arrayBuffer());
    imageBase64 = buffer.toString("base64");
  } else {
    return NextResponse.json(
      { error: "No se pudo leer el archivo del comprobante" },
      { status: 500 },
    );
  }

  const fee = typeof payment.consultationFee === "number" ? payment.consultationFee : 0;
  const result = await validatePaymentReceipt({
    imageBase64,
    mimeType: (docRow.mime_type as string) || "image/jpeg",
    fileName: (docRow.file_name as string) || undefined,
    doctorName: professional?.full_name ?? "",
    doctorAlias: (payment.alias as string | undefined),
    doctorCbu: (payment.cbu as string | undefined),
    beneficiaryName: (payment.beneficiaryName as string | undefined),
    expectedAmount: fee,
    currency: (payment.currency as string | undefined) ?? "ARS",
    appointmentDateIso: row.scheduled_at as string,
    slotDurationMinutes: availability?.slotDurationMinutes,
  });

  const audit = buildPaymentReceiptAudit(
    result,
    fee,
    (payment.currency as string | undefined) ?? "ARS",
  );
  const now = new Date().toISOString();

  await supabase
    .from("appointments")
    .update({
      payment_receipt_audit: audit,
      payment_provider: (row.payment_provider as string | null) ?? "transfer",
      updated_at: now,
    })
    .eq("id", row.id as string);

  if (result.valid) {
    await confirmAppointmentPaymentAndNotify(row.id as string);
  } else {
    const { data: updated } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", row.id as string)
      .maybeSingle();

    if (updated) {
      const u = updated as Record<string, unknown>;
      await markTransferReceiptPendingReview(
        {
          id: u.id as string,
          payment_status: u.payment_status as string | undefined,
          payment_provider: u.payment_provider as string | undefined,
          patient_id: u.patient_id as string,
          doctor_id: u.doctor_id as string,
          org_id: u.org_id as string,
        },
        { audit, notifyDoctor: true },
      );
    }
  }

  return NextResponse.json({ ...result, audit });
}
