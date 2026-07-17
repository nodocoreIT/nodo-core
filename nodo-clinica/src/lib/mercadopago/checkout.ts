import { isLocalMode } from "@/lib/clinic/config";
import { readDb, writeDb } from "@/lib/clinic/local-db";
import { appBaseUrl } from "@/lib/clinic/appointment-payment";
import { doctorUsesMercadoPago } from "@/lib/clinic/payment";
import { getDoctorMercadoPagoAccessToken } from "@/lib/mercadopago/tokens";
import { createServiceClient } from "@/lib/supabase/server";
import {
  checkoutUrl,
  createCheckoutPreference,
  getMercadoPagoUser,
} from "@/lib/mercadopago/client";

async function buildLocalCheckout(appointmentId: string) {
  const db = await readDb();
  const apt = db.appointments.find((a) => a.id === appointmentId);
  if (!apt) return null;

  const doctor = db.doctors.find((d) => d.id === apt.doctorId);
  const patient = db.patients.find((p) => p.id === apt.patientId);
  if (!doctor || !patient || !doctorUsesMercadoPago(doctor)) return null;

  const token = await getDoctorMercadoPagoAccessToken(doctor);
  const fee = doctor.payment?.consultationFee ?? 0;
  if (!token || fee <= 0) return null;

  try {
    await getMercadoPagoUser(token);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Token de Mercado Pago inválido";
    throw new Error(msg);
  }

  const base = appBaseUrl();
  const waitingPath = `/paciente/sala/${apt.accessToken}`;

  const pref = await createCheckoutPreference({
    accessToken: token,
    title: `Consulta — Dr/a. ${doctor.fullName}`,
    amount: fee,
    currency: doctor.payment?.currency,
    externalReference: apt.id,
    payerEmail: patient.email,
    notificationUrl: `${base}/api/webhooks/mercadopago`,
    backUrls: {
      success: `${base}${waitingPath}?mp=success`,
      failure: `${base}${waitingPath}?mp=failure`,
      pending: `${base}${waitingPath}?mp=pending`,
    },
  });

  await writeDb((d) => {
    const target = d.appointments.find((a) => a.id === apt.id);
    if (target) {
      target.mercadopagoPreferenceId = pref.id;
      target.paymentProvider = "mercadopago";
      target.updatedAt = new Date().toISOString();
    }
  });

  return {
    checkoutUrl: checkoutUrl(pref, token),
    preferenceId: pref.id,
  };
}

async function buildSupabaseCheckout(appointmentId: string) {
  const supabase = await createServiceClient();

  const { data: apt } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!apt) return null;

  const { data: patient } = await supabase
    .from("patients")
    .select("email, full_name")
    .eq("id", apt.patient_id)
    .maybeSingle();

  const { data: officeSettings } = await supabase
    .from("office_settings")
    .select("payment")
    .eq("org_id", apt.org_id)
    .maybeSingle();

  const { data: professional } = await supabase
    .from("professionals")
    .select("full_name")
    .eq("id", apt.doctor_id)
    .maybeSingle();

  if (!patient || !professional) return null;

  const payment = (officeSettings?.payment as Record<string, unknown>) ?? {};
  const fee = typeof payment.consultationFee === "number" ? payment.consultationFee : 0;
  const currency = (payment.currency as string | undefined) ?? "ARS";
  const mercadopagoEnabled = !!payment.mercadopagoEnabled;

  if (!mercadopagoEnabled || fee <= 0) return null;

  const token = await getDoctorMercadoPagoAccessToken(apt.org_id);
  if (!token) return null;

  const base = appBaseUrl();
  const waitingPath = `/paciente/sala/${apt.access_token}`;

  const pref = await createCheckoutPreference({
    accessToken: token,
    title: `Consulta — Dr/a. ${professional.full_name}`,
    amount: fee,
    currency,
    externalReference: apt.id,
    payerEmail: patient.email,
    notificationUrl: `${base}/api/webhooks/mercadopago`,
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

export async function buildCheckoutForAppointment(appointmentId: string) {
  if (isLocalMode()) return buildLocalCheckout(appointmentId);
  return buildSupabaseCheckout(appointmentId);
}
