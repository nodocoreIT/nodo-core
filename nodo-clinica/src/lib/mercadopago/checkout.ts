import { readDb, writeDb } from "@/lib/clinic/local-db";
import { doctorUsesMercadoPago } from "@/lib/clinic/payment";
import { appBaseUrl } from "@/lib/clinic/appointment-payment";
import { getDoctorMercadoPagoAccessToken } from "@/lib/mercadopago/tokens";
import {
  checkoutUrl,
  createCheckoutPreference,
  getMercadoPagoUser,
} from "@/lib/mercadopago/client";

export async function buildCheckoutForAppointment(appointmentId: string) {
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
