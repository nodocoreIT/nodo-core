import { supabase } from "@/shared/lib/supabase";
import { appBaseUrl } from "@/shared/lib/appointment-payment";
import {
  checkoutUrl,
  createCheckoutPreference,
} from "@/shared/lib/mercadopago/client";

interface DoctorPaymentRow {
  id: string;
  full_name: string;
  payment_access_token?: string;
  consultation_fee?: number;
  payment_currency?: string;
  mercadopago_enabled?: boolean;
}

interface AppointmentRow {
  id: string;
  doctor_id: string;
  patient_id: string;
  access_token: string;
  mercadopago_preference_id?: string;
}

export async function buildCheckoutForAppointment(appointmentId: string): Promise<{
  checkoutUrl: string;
  preferenceId: string;
} | null> {
  const { data: apt } = await supabase
    .from("appointments")
    .select("id, doctor_id, patient_id, access_token")
    .eq("id", appointmentId)
    .single<AppointmentRow>();

  if (!apt) return null;

  const { data: doctor } = await supabase
    .from("profiles")
    .select("id, full_name, payment_access_token, consultation_fee, payment_currency, mercadopago_enabled")
    .eq("id", apt.doctor_id)
    .single<DoctorPaymentRow>();

  const { data: patient } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", apt.patient_id)
    .single<{ id: string; email: string }>();

  if (!doctor || !patient) return null;
  if (!doctor.mercadopago_enabled) return null;

  const token = doctor.payment_access_token?.trim();
  const fee = doctor.consultation_fee ?? 0;
  if (!token || fee <= 0) return null;

  const base = appBaseUrl();
  const waitingPath = `/paciente/sala/${apt.access_token}`;

  const pref = await createCheckoutPreference({
    accessToken: token,
    title: `Consulta — Dr/a. ${doctor.full_name}`,
    amount: fee,
    currency: doctor.payment_currency,
    externalReference: apt.id,
    payerEmail: patient.email,
    notificationUrl: `${base}/api/clinic/mercadopago/webhook`,
    backUrls: {
      success: `${base}${waitingPath}?mp=success`,
      failure: `${base}${waitingPath}?mp=failure`,
      pending: `${base}${waitingPath}?mp=pending`,
    },
  });

  await supabase
    .from("appointments")
    .update({
      mercadopago_preference_id: pref.id,
      payment_provider: "mercadopago",
      updated_at: new Date().toISOString(),
    })
    .eq("id", apt.id);

  return {
    checkoutUrl: checkoutUrl(pref, token),
    preferenceId: pref.id,
  };
}
