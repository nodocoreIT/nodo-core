import { newId, readDb, writeDb } from "@/lib/clinic/local-db";
import type { DoctorNotification } from "@/lib/clinic/local-db";

export async function listDoctorNotifications(
  doctorId: string,
  opts?: { unreadOnly?: boolean; limit?: number },
): Promise<DoctorNotification[]> {
  const db = await readDb();
  let items = (db.doctorNotifications ?? []).filter((n) => n.doctorId === doctorId);
  if (opts?.unreadOnly) items = items.filter((n) => !n.read);
  items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return items.slice(0, opts?.limit ?? 50);
}

export async function countUnreadDoctorNotifications(
  doctorId: string,
  types?: DoctorNotification["type"][],
): Promise<number> {
  const items = await listDoctorNotifications(doctorId, { unreadOnly: true });
  if (!types?.length) return items.length;
  return items.filter((n) => types.includes(n.type)).length;
}

export async function markDoctorNotificationsRead(
  doctorId: string,
  ids?: string[],
): Promise<number> {
  let marked = 0;
  await writeDb((db) => {
    if (!db.doctorNotifications) db.doctorNotifications = [];
    for (const n of db.doctorNotifications) {
      if (n.doctorId !== doctorId || n.read) continue;
      if (ids?.length && !ids.includes(n.id)) continue;
      n.read = true;
      marked++;
    }
  });
  return marked;
}

export async function notifyDoctorMercadoPagoPayment(params: {
  doctorId: string;
  appointmentId: string;
  mercadopagoPaymentId: string;
  patientName: string;
  amount?: number;
  currency?: string;
}): Promise<DoctorNotification | null> {
  const db = await readDb();
  const exists = (db.doctorNotifications ?? []).some(
    (n) =>
      n.doctorId === params.doctorId &&
      n.type === "mercadopago_payment" &&
      (n.meta?.mercadopagoPaymentId === params.mercadopagoPaymentId ||
        n.meta?.appointmentId === params.appointmentId),
  );
  if (exists) return null;

  const amountLabel =
    params.amount != null
      ? `${params.currency ?? "ARS"} ${params.amount.toLocaleString("es-AR")}`
      : "honorario";

  const notification: DoctorNotification = {
    id: newId("dn"),
    doctorId: params.doctorId,
    type: "mercadopago_payment",
    title: "Cobro recibido — Mercado Pago",
    message: `${params.patientName} pagó ${amountLabel}. Turno confirmado.`,
    href: "/medico/cobros",
    read: false,
    createdAt: new Date().toISOString(),
    meta: {
      appointmentId: params.appointmentId,
      mercadopagoPaymentId: params.mercadopagoPaymentId,
      amount: params.amount,
      currency: params.currency,
    },
  };

  await writeDb((d) => {
    if (!d.doctorNotifications) d.doctorNotifications = [];
    d.doctorNotifications.push(notification);
  });

  return notification;
}

export async function notifyDoctorTransferPendingReview(params: {
  doctorId: string;
  appointmentId: string;
  patientName: string;
}): Promise<DoctorNotification> {
  const notification: DoctorNotification = {
    id: newId("dn"),
    doctorId: params.doctorId,
    type: "transfer_pending",
    title: "Comprobante pendiente de revisión",
    message: `${params.patientName} subió un comprobante. Revisalo en Cobros.`,
    href: "/medico/cobros",
    read: false,
    createdAt: new Date().toISOString(),
    meta: { appointmentId: params.appointmentId },
  };

  await writeDb((d) => {
    if (!d.doctorNotifications) d.doctorNotifications = [];
    d.doctorNotifications.push(notification);
  });

  return notification;
}
