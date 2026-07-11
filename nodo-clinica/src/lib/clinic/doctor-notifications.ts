import { createServiceClient } from "@/lib/supabase/server";

// The doctor_notifications table is not in the generated Supabase types yet.
// We use an untyped client to avoid compilation errors that break the entire
// notifications API route (GET + PATCH → 404 in production).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getUntypedClient(): Promise<any> {
  return createServiceClient();
}

export type DoctorNotificationType =
  | "mercadopago_payment"
  | "transfer_pending"
  | "general";

export interface DoctorNotification {
  id: string;
  org_id: string;
  professional_id: string;
  type: DoctorNotificationType;
  payload: {
    title?: string;
    message?: string;
    href?: string;
    appointmentId?: string;
    mercadopagoPaymentId?: string;
    amount?: number;
    currency?: string;
  } | null;
  read: boolean;
  created_at: string;
}

// Legacy-compat shape used by notifications route
export interface DoctorNotificationLegacy {
  id: string;
  doctorId: string;
  type: DoctorNotificationType;
  title: string;
  message: string;
  href?: string;
  read: boolean;
  createdAt: string;
  meta?: {
    appointmentId?: string;
    mercadopagoPaymentId?: string;
    amount?: number;
    currency?: string;
  };
}

function tolegacy(n: DoctorNotification): DoctorNotificationLegacy {
  return {
    id: n.id,
    doctorId: n.professional_id,
    type: n.type,
    title: n.payload?.title ?? "",
    message: n.payload?.message ?? "",
    href: n.payload?.href,
    read: n.read,
    createdAt: n.created_at,
    meta: {
      appointmentId: n.payload?.appointmentId,
      mercadopagoPaymentId: n.payload?.mercadopagoPaymentId,
      amount: n.payload?.amount,
      currency: n.payload?.currency,
    },
  };
}

export async function listDoctorNotifications(
  professionalId: string,
  opts?: { unreadOnly?: boolean; limit?: number },
): Promise<DoctorNotificationLegacy[]> {
  const supabase = await getUntypedClient();
  let query = supabase
    .from("doctor_notifications")
    .select("*")
    .eq("professional_id", professionalId)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);

  if (opts?.unreadOnly) {
    query = query.eq("read", false);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[doctor-notifications] listDoctorNotifications error", error);
    return [];
  }
  return (data as DoctorNotification[]).map(tolegacy);
}

export async function countUnreadDoctorNotifications(
  professionalId: string,
  types?: DoctorNotificationType[],
): Promise<number> {
  const supabase = await getUntypedClient();
  let query = supabase
    .from("doctor_notifications")
    .select("*", { count: "exact", head: true })
    .eq("professional_id", professionalId)
    .eq("read", false);

  if (types?.length) {
    query = query.in("type", types);
  }

  const { count, error } = await query;
  if (error) {
    console.error("[doctor-notifications] countUnreadDoctorNotifications error", error);
    return 0;
  }
  return count ?? 0;
}

export async function markDoctorNotificationsRead(
  professionalId: string,
  ids?: string[],
): Promise<number> {
  const supabase = await getUntypedClient();
  let query = supabase
    .from("doctor_notifications")
    .update({ read: true })
    .eq("professional_id", professionalId)
    .eq("read", false);

  if (ids?.length) {
    query = query.in("id", ids);
  }

  const { data, error } = await query.select("id");
  if (error) {
    console.error("[doctor-notifications] markDoctorNotificationsRead error", error);
    return 0;
  }
  return (data as { id: string }[]).length;
}

export async function notifyDoctorMercadoPagoPayment(params: {
  doctorId: string;
  orgId: string;
  appointmentId: string;
  mercadopagoPaymentId: string;
  patientName: string;
  amount?: number;
  currency?: string;
}): Promise<DoctorNotificationLegacy | null> {
  const supabase = await getUntypedClient();

  // Deduplicate: skip if this payment was already notified
  const { data: existing } = await supabase
    .from("doctor_notifications")
    .select("id")
    .eq("professional_id", params.doctorId)
    .eq("type", "mercadopago_payment")
    .or(
      `payload->>'mercadopagoPaymentId'.eq.${params.mercadopagoPaymentId},payload->>'appointmentId'.eq.${params.appointmentId}`,
    )
    .maybeSingle();

  if (existing) return null;

  const amountLabel =
    params.amount != null
      ? `${params.currency ?? "ARS"} ${params.amount.toLocaleString("es-AR")}`
      : "honorario";

  const { data, error } = await supabase
    .from("doctor_notifications")
    .insert({
      org_id: params.orgId,
      professional_id: params.doctorId,
      type: "mercadopago_payment" as DoctorNotificationType,
      payload: {
        title: "Cobro recibido — Mercado Pago",
        message: `${params.patientName} pagó ${amountLabel}. Turno confirmado.`,
        href: "/medico/cobros",
        appointmentId: params.appointmentId,
        mercadopagoPaymentId: params.mercadopagoPaymentId,
        amount: params.amount,
        currency: params.currency,
      },
      read: false,
    })
    .select()
    .single();

  if (error) {
    console.error("[doctor-notifications] notifyDoctorMercadoPagoPayment error", error);
    return null;
  }
  return tolegacy(data as DoctorNotification);
}

export async function notifyDoctorTransferPendingReview(params: {
  doctorId: string;
  orgId: string;
  appointmentId: string;
  patientName: string;
}): Promise<DoctorNotificationLegacy> {
  const supabase = await getUntypedClient();
  const { data, error } = await supabase
    .from("doctor_notifications")
    .insert({
      org_id: params.orgId,
      professional_id: params.doctorId,
      type: "transfer_pending" as DoctorNotificationType,
      payload: {
        title: "Comprobante pendiente de revisión",
        message: `${params.patientName} subió un comprobante. Revisalo en Cobros.`,
        href: "/medico/cobros",
        appointmentId: params.appointmentId,
      },
      read: false,
    })
    .select()
    .single();

  if (error) {
    console.error("[doctor-notifications] notifyDoctorTransferPendingReview error", error);
  }
  return tolegacy((data ?? {}) as DoctorNotification);
}
