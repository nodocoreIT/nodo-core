import { supabase } from "@/shared/lib/supabase";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function appBaseUrl(): string {
  return (
    (import.meta.env.VITE_APP_URL as string | undefined) ||
    window.location.origin
  );
}

export async function confirmAppointmentPayment(
  appointmentId: string,
  opts?: { mercadopagoPaymentId?: string }
): Promise<boolean> {
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = {
    payment_status: "confirmed",
    payment_confirmed_at: now,
    updated_at: now,
  };

  if (opts?.mercadopagoPaymentId) {
    updates.mercadopago_payment_id = opts.mercadopagoPaymentId;
  }

  const { error } = await supabase
    .from("appointments")
    .update(updates)
    .eq("id", appointmentId)
    .in("payment_status", ["pending", null]);

  return !error;
}

export function formatAppointmentLabel(scheduledAt: string): string {
  return format(
    new Date(scheduledAt),
    "EEEE d 'de' MMMM 'a las' HH:mm 'hs'",
    { locale: es }
  );
}
