import { createServiceClient } from "@/lib/supabase/server";
import { refundPayment } from "@/lib/mercadopago/client";
import { getDoctorMercadoPagoAccessToken } from "@/lib/mercadopago/tokens";

type RefundResult =
  | { ok: true; appointment: Record<string, unknown> }
  | { ok: false; error: string };

export async function refundAppointmentViaMercadoPago(
  appointmentId: string,
): Promise<RefundResult> {
  const supabase = await createServiceClient();

  const { data: apt, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .maybeSingle();
  if (error || !apt) return { ok: false, error: "Turno no encontrado" };
  if (apt.status !== "cancelled") {
    return { ok: false, error: "El turno debe estar cancelado antes de reembolsar" };
  }
  if (apt.payment_status !== "confirmed") {
    return { ok: false, error: "No hay un pago confirmado para reembolsar" };
  }
  if (apt.payment_provider !== "mercadopago" || !apt.mercadopago_payment_id) {
    return { ok: false, error: "Este turno no tiene un pago de Mercado Pago asociado" };
  }

  const accessToken = await getDoctorMercadoPagoAccessToken(apt.doctor_id);
  if (!accessToken) {
    return { ok: false, error: "El médico no tiene Mercado Pago conectado" };
  }

  try {
    const refund = await refundPayment(accessToken, apt.mercadopago_payment_id);
    const { data: updated, error: updateError } = await supabase
      .from("appointments")
      .update({
        payment_status: "refunded",
        refund_method: "mercadopago",
        refund_amount: refund.amount,
        refund_id: String(refund.id),
        refunded_at: new Date().toISOString(),
        payment_receipt_audit: {
          ...((apt.payment_receipt_audit as Record<string, unknown>) ?? {}),
          mpRefund: refund,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId)
      .select()
      .single();
    if (updateError || !updated) {
      return { ok: false, error: updateError?.message ?? "Error al guardar el reembolso" };
    }
    return { ok: true, appointment: updated };
  } catch (err) {
    // El reembolso en Mercado Pago falló: la cancelación del turno NO se revierte
    // (el horario ya está liberado). Queda marcado para poder reintentar después —
    // reintentar es seguro porque refundPayment manda un X-Idempotency-Key.
    const message = err instanceof Error ? err.message : "Error desconocido al reembolsar";
    await supabase
      .from("appointments")
      .update({
        payment_status: "refund_failed",
        refund_notes: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId);
    return { ok: false, error: message };
  }
}

export async function markAppointmentRefundedManually(
  appointmentId: string,
): Promise<RefundResult> {
  const supabase = await createServiceClient();

  const { data: apt, error } = await supabase
    .from("appointments")
    .select("id, status, payment_status, payment_provider")
    .eq("id", appointmentId)
    .maybeSingle();
  if (error || !apt) return { ok: false, error: "Turno no encontrado" };
  if (apt.status !== "cancelled") {
    return { ok: false, error: "El turno debe estar cancelado antes de registrar la devolución" };
  }
  if (apt.payment_provider !== "transfer") {
    return { ok: false, error: "Este turno no fue pagado por transferencia" };
  }

  const { data: updated, error: updateError } = await supabase
    .from("appointments")
    .update({
      payment_status: "refunded",
      refund_method: "transfer_manual",
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .select()
    .single();
  if (updateError || !updated) {
    return { ok: false, error: updateError?.message ?? "Error al registrar la devolución" };
  }
  return { ok: true, appointment: updated };
}
