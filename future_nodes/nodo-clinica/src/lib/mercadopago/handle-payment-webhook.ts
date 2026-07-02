import { readDb } from "@/lib/clinic/local-db";
import type { LocalDoctor } from "@/lib/clinic/local-db";
import { confirmAppointmentPaymentAndNotify } from "@/lib/clinic/appointment-payment";
import { getDoctorMercadoPagoAccessToken } from "@/lib/mercadopago/tokens";
import { getPayment, type MpPaymentInfo } from "@/lib/mercadopago/client";

async function fetchPaymentWithDoctorToken(
  doctor: LocalDoctor,
  paymentId: string,
): Promise<MpPaymentInfo | null> {
  const token = await getDoctorMercadoPagoAccessToken(doctor);
  if (!token) return null;
  try {
    return await getPayment(token, paymentId);
  } catch {
    return null;
  }
}

export async function processMercadoPagoPaymentId(
  paymentId: string,
  opts?: { appointmentIdHint?: string },
): Promise<{ ok: boolean; appointmentId?: string; skipped?: string }> {
  const db = await readDb();

  const doctorsToTry: LocalDoctor[] = [];
  if (opts?.appointmentIdHint) {
    const apt = db.appointments.find((a) => a.id === opts.appointmentIdHint);
    if (apt) {
      const doctor = db.doctors.find((d) => d.id === apt.doctorId);
      if (doctor) doctorsToTry.push(doctor);
    }
  }
  for (const doctor of db.doctors) {
    if (!doctorsToTry.some((d) => d.id === doctor.id)) {
      doctorsToTry.push(doctor);
    }
  }

  for (const doctor of doctorsToTry) {
    const payment = await fetchPaymentWithDoctorToken(doctor, paymentId);
    if (!payment) continue;

    if (payment.status !== "approved") {
      return { ok: true, skipped: `status:${payment.status}` };
    }

    const appointmentId = payment.external_reference;
    if (!appointmentId) {
      return { ok: true, skipped: "no_external_reference" };
    }

    const apt = db.appointments.find((a) => a.id === appointmentId);
    if (!apt || apt.doctorId !== doctor.id) continue;

    await confirmAppointmentPaymentAndNotify(appointmentId, {
      mercadopagoPaymentId: String(payment.id),
    });

    return { ok: true, appointmentId };
  }

  return { ok: true, skipped: "payment_not_matched" };
}
