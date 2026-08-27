import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";
import {
  refundAppointmentViaMercadoPago,
  markAppointmentRefundedManually,
} from "@/lib/clinic/appointment-refund";
import {
  getAppointments,
  getAppointmentByToken,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  countAppointmentsForDoctor,
} from "@/lib/clinic/db/appointments";
import { createNote } from "@/lib/clinic/db/clinical-records";
import {
  DEFAULT_AVAILABILITY,
  localDateKeyFromDate,
  localDateKeyFromIso,
  appointmentMatchesScheduleGrid,
  slotKeyFromIso,
  addDaysToDateKey,
  formatAppointmentLabelFromIso,
  DoctorAvailability,
  appointmentRangeOverlaps,
} from "@/lib/clinic/schedule";
import {
  isPaymentConfirmed,
  doctorRequiresPayment,
  doctorUsesMercadoPago,
} from "@/lib/clinic/payment";
import { isStrictPaymentValidation } from "@/lib/clinic/payment-validation";
import { professionalHasMercadoPagoConnection } from "@/lib/clinic/db/payments";
import { sendAppointmentConfirmationEmail } from "@/lib/email/resend";
import { formatReminderLabel } from "@/lib/email/reminder-label";
import { buildCheckoutForAppointment } from "@/lib/mercadopago/checkout";
import {
  appBaseUrl,
  confirmAppointmentPaymentAndNotify,
  patientLoginUrl,
} from "@/lib/clinic/appointment-payment";
import { appendConsultationArtifacts } from "@/lib/clinic/finalize-appointment";
import { validatePaymentReceipt } from "@/lib/ai/payment-receipt";
import { notifyDoctorTransferPendingReview } from "@/lib/clinic/doctor-notifications";
import {
  receiptDateOlderThanBooking,
  resolveCobroReceiptFields,
} from "@/lib/clinic/cobros-receipt";
import { buildPaymentReceiptAudit } from "@/lib/clinic/payment-receipt-audit";
import { getBookableProfessional } from "@/lib/clinic/db/professionals";
import { attachDocumentToAppointment } from "@/lib/clinic/appointment-documents";
import {
  appointmentNeedsDoctorPaymentReviewFromDbRow,
  appointmentIncludedInPaymentLedger,
} from "@/lib/clinic/payment";
import { isLocalMode } from "@/lib/clinic/config";
import { resolveAppointmentByAccessToken } from "@/lib/clinic/appointment-token-auth";
import { mapSessionClinicalDocuments } from "@/lib/clinic/session-clinical-documents";
import { handleAppointmentsGetLocal } from "@/lib/clinic/appointments-local-get";
import { handleAppointmentsPostLocal } from "@/lib/clinic/appointments-local-post";
import { handleAppointmentsPatchLocal } from "@/lib/clinic/appointments-local-patch";

// ── Helpers ───────────────────────────────────────────────────────────────────

const APPOINTMENT_STATUS_PRIORITY: Record<string, number> = {
  in_consultation: 0,
  waiting: 1,
  scheduled: 2,
  completed: 3,
};

function dedupeDoctorAppointments<
  T extends { patient_id: string; scheduled_at: string; status: string },
>(appointments: T[]): T[] {
  const bySlot = new Map<string, T>();
  for (const apt of appointments) {
    const key = `${apt.patient_id}-${slotKeyFromIso(apt.scheduled_at)}`;
    const existing = bySlot.get(key);
    if (!existing) {
      bySlot.set(key, apt);
      continue;
    }
    const aptPriority = APPOINTMENT_STATUS_PRIORITY[apt.status] ?? 9;
    const existingPriority = APPOINTMENT_STATUS_PRIORITY[existing.status] ?? 9;
    if (aptPriority < existingPriority) {
      bySlot.set(key, apt);
    }
  }
  return Array.from(bySlot.values());
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (isLocalMode()) {
    return handleAppointmentsGetLocal(request);
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  // A valid, non-expired access_token is sufficient credential to read this
  // ONE appointment — no login required (magic-link style). This must stay
  // scoped to exactly this branch; it does not affect doctorId/patientId
  // lookups below, which still require a real session via requireAuth().
  if (token) {
    const apt = await resolveAppointmentByAccessToken(token);
    if (!apt) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 },
      );
    }

    const supabase = await createServiceClient();

    // Check the patient into the queue as soon as they load the turno with
    // payment already settled — done here (server-side, on read) so it works
    // the same whether this GET came from a logged-in session or straight
    // from the magic-link token, with no separate authenticated PATCH needed.
    if (
      apt.status === "scheduled" &&
      (!apt.payment_status ||
        apt.payment_status === "confirmed" ||
        apt.payment_status === "waived")
    ) {
      await supabase
        .from("appointments")
        .update({ status: "waiting" })
        .eq("id", apt.id);
      apt.status = "waiting";
    }

    const [{ data: patient }, { data: professional }, { data: doctorQueueApts }, { data: docs }, { data: clinicalRecords }] =
      await Promise.all([
        supabase.from("patients").select("*").eq("id", apt.patient_id).maybeSingle(),
        supabase
          .from("professionals")
          .select("*, office_settings(*)")
          .eq("id", apt.doctor_id)
          .maybeSingle(),
        supabase
          .from("appointments")
          .select("id, scheduled_at, status")
          .eq("doctor_id", apt.doctor_id)
          .in("status", ["waiting", "in_consultation"]),
        supabase
          .from("patient_documents")
          .select("*")
          .eq("appointment_id", apt.id),
        supabase
          .from("clinical_records")
          .select("id, title, record_type, created_at")
          .eq("appointment_id", apt.id)
          .in("record_type", ["receta", "estudio"])
          .order("created_at", { ascending: true }),
      ]);

    // Queue order follows appointment time (same day as this turno), not
    // booking order — a patient booked later for an earlier slot still goes first.
    const aptDateKey = localDateKeyFromIso(apt.scheduled_at);
    const sameDayQueue = (doctorQueueApts ?? []).filter(
      (a) => localDateKeyFromIso(a.scheduled_at) === aptDateKey,
    );
    const aheadCount = sameDayQueue.filter(
      (a) =>
        a.id !== apt.id &&
        (a.status === "in_consultation" ||
          new Date(a.scheduled_at).getTime() < new Date(apt.scheduled_at).getTime()),
    ).length;
    const waitingCount = sameDayQueue.length;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const officeSettingsPayment = ((professional as any)?.office_settings?.payment ?? {}) as Record<
      string,
      unknown
    >;
    const consultationFee =
      typeof officeSettingsPayment.consultationFee === "number"
        ? officeSettingsPayment.consultationFee
        : 0;
    const mpConnected = professional?.id
      ? await professionalHasMercadoPagoConnection(professional.id)
      : false;
    const doctorPayment = {
      consultationFee,
      currency: (officeSettingsPayment.currency as string) ?? "ARS",
      alias: officeSettingsPayment.alias as string | undefined,
      cbu: officeSettingsPayment.cbu as string | undefined,
      paymentInstructions: officeSettingsPayment.paymentInstructions as string | undefined,
      qrImageData: officeSettingsPayment.qrImageData as string | undefined,
      mercadopagoReady: mpConnected && consultationFee > 0,
    };

    return NextResponse.json({
      appointment: {
        id: apt.id,
        patientId: apt.patient_id,
        doctorId: apt.doctor_id,
        scheduledAt: apt.scheduled_at,
        status: apt.status,
        queuePosition: apt.queue_position,
        jitsiRoomId: apt.jitsi_room_id,
        accessToken: apt.access_token,
        tokenExpiresAt: apt.token_expires_at,
        createdAt: apt.created_at,
        updatedAt: apt.updated_at,
        paymentStatus: apt.payment_status,
        paymentProvider: apt.payment_provider,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        paymentReceiptAudit: (apt as any).payment_receipt_audit,
        intakeReason: apt.intake_reason,
      },
      patient: patient
        ? {
            id: patient.id,
            fullName: patient.full_name,
            email: patient.email,
          }
        : undefined,
      doctor: professional
        ? {
            id: professional.id,
            fullName: professional.full_name,
            specialty: professional.specialty,
            profilePhotoUrl: professional.profile_photo_url,
            payment: doctorPayment,
          }
        : undefined,
      queuePosition: aheadCount + 1,
      totalWaiting: waitingCount,
      strictPaymentValidation: isStrictPaymentValidation(),
      documents: (docs ?? []).map((d) => ({
        id: d.id,
        fileName: d.file_name,
        uploadedAt: d.uploaded_at,
        mimeType: d.mime_type,
        documentType: d.document_type ?? "study",
        downloadUrl: `/api/clinic/documents?id=${d.id}&download=1&token=${encodeURIComponent(apt.access_token)}`,
      })),
      sessionDocuments: mapSessionClinicalDocuments(
        clinicalRecords ?? [],
        apt.access_token,
      ),
    });
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const doctorId = searchParams.get("doctorId");
  const patientId = searchParams.get("patientId");

  if (patientId) {
    const svc = await createServiceClient();
    const profileId = user.role === "patient" ? user.id : patientId;

    const { data: patientRow, error: patientRowError } = await svc
      .from("patients")
      .select("id, org_id")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (user.role === "patient" && !patientRow) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { data: appointments, error: appointmentsError } = patientRow
      ? await svc
          .from("appointments")
          .select("*, patient_documents(*)")
          .eq("patient_id", patientRow.id)
          .eq("org_id", patientRow.org_id)
          .order("scheduled_at", { ascending: true })
      : { data: [], error: null };

    const doctorIds = [
      ...new Set((appointments ?? []).map((apt) => apt.doctor_id).filter(Boolean)),
    ];
    const { data: professionals } =
      doctorIds.length > 0
        ? await svc
            .from("professionals")
            .select("id, full_name, specialty, profile_photo_url")
            .in("id", doctorIds)
        : { data: [] as Array<{
            id: string;
            full_name: string;
            specialty: string | null;
            profile_photo_url: string | null;
          }> };
    const professionalById = new Map(
      (professionals ?? []).map((p) => [p.id, p]),
    );

    if (searchParams.get("debug") === "1") {
      return NextResponse.json({
        authUserId: user.id,
        patientRow,
        patientRowError,
        appointmentsCount: appointments?.length ?? 0,
        appointmentsError,
        doctorIds,
        professionalsFound: professionals?.length ?? 0,
      });
    }

    return NextResponse.json(
      (appointments ?? []).map((apt) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const audit = (apt as any).payment_receipt_audit as Record<string, unknown> | null;
        const professional = professionalById.get(apt.doctor_id);
        return {
          id: apt.id,
          scheduledAt: apt.scheduled_at,
          status: apt.status,
          accessToken: apt.access_token,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          paymentStatus: (apt as any).payment_status,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cancelledBy: (apt as any).cancelled_by ?? null,
          paymentRejected: typeof audit?.rejectionReason === "string",
          needsReview: appointmentNeedsDoctorPaymentReviewFromDbRow(apt as never, {
            receiptDocumentCount: (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((apt as any).patient_documents ?? []) as Array<{ document_type?: string }>
            ).filter((d) => d.document_type === "payment_receipt").length,
          }),
          doctor: professional
            ? {
                fullName: professional.full_name,
                specialty: professional.specialty ?? undefined,
                profilePhotoUrl: professional.profile_photo_url ?? undefined,
              }
            : undefined,
        };
      }),
    );
  }

  if (doctorId) {
    const scope = searchParams.get("scope") ?? "upcoming";

    const me = await resolveProfessional(authResult);
    if (!me || me.id !== doctorId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Service client: doctor reads must not depend on JWT org_id / nested RLS joins.
    const svc = await createServiceClient();

    if (scope === "cobros_received") {
      const { data: professional } = await svc
        .from("professionals")
        .select("*, office_settings(*)")
        .eq("id", doctorId)
        .maybeSingle();

      const defaultAmount =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (professional?.office_settings as any)?.payment?.consultationFee ?? 0;

      const { data: confirmed } = await svc
        .from("appointments")
        .select("*, patients(full_name), patient_documents(*)")
        .eq("doctor_id", doctorId)
        .eq("payment_status", "confirmed")
        .not("payment_confirmed_at", "is", null)
        .order("payment_confirmed_at", { ascending: false })
        .limit(100);

      const entries = (confirmed ?? []).map((apt) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const meta = (apt as any).payment_receipt_audit as Record<string, unknown> | null;
        const receipt = resolveCobroReceiptFields(apt as never);
        return {
          id: apt.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          patientName: (apt as any).patients?.full_name ?? "Paciente",
          paidAt: apt.payment_confirmed_at,
          bookedAt: apt.created_at,
          scheduledAt: apt.scheduled_at,
          paymentProvider: apt.payment_provider,
          amount: (meta?.amount as number) ?? defaultAmount,
          currency: "ARS" as const,
          receiptTransferDate: receipt.receiptTransferDate,
          receiptTransferTime: receipt.receiptTransferTime,
          operationId: receipt.operationId,
          mercadopagoPaymentId: apt.mercadopago_payment_id ?? null,
          receiptOlderThanBooking: receiptDateOlderThanBooking(
            receipt.receiptTransferDate,
            apt.created_at,
          ),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          documents: ((apt as any).patient_documents ?? [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((d: any) => d.document_type === "payment_receipt")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((d: any) => ({
              id: d.id,
              fileName: d.file_name,
              downloadUrl: `/api/clinic/documents?id=${d.id}&download=1`,
            })),
        };
      });

      return NextResponse.json({ entries });
    }

    if (scope === "payment_ledger") {
      // No .neq("status", "cancelled") here on purpose: a payment the doctor
      // rejected cancels the appointment, but it still needs to show up in
      // the ledger as "Rechazado" — the JS filter below already keeps only
      // rows that have a receipt audit or a confirmed payment either way.
      const { data: ledger } = await svc
        .from("appointments")
        .select("*, patients(full_name, phone), patient_documents(*)")
        .eq("doctor_id", doctorId)
        .order("scheduled_at", { ascending: false })
        .limit(500);

      const entries = (ledger ?? [])
        .filter((apt) =>
          appointmentIncludedInPaymentLedger(apt as never, {
            receiptDocumentCount: (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((apt as any).patient_documents ?? []) as Array<{ document_type?: string }>
            ).filter((d) => d.document_type === "payment_receipt").length,
          }),
        )
        .map((apt) => ({
          id: apt.id,
          status: apt.status,
          scheduledAt: apt.scheduled_at,
          createdAt: apt.created_at,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          patientName: (apt as any).patients?.full_name ?? "Paciente",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          patientPhone: (apt as any).patients?.phone ?? undefined,
          paymentStatus: apt.payment_status,
          paymentProvider: apt.payment_provider,
          audit: apt.payment_receipt_audit,
          needsReview: appointmentNeedsDoctorPaymentReviewFromDbRow(apt as never, {
            receiptDocumentCount: (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((apt as any).patient_documents ?? []) as Array<{ document_type?: string }>
            ).filter((d) => d.document_type === "payment_receipt").length,
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          documents: ((apt as any).patient_documents ?? [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((d: any) => d.document_type === "payment_receipt")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((d: any) => ({
              id: d.id,
              fileName: d.file_name,
              downloadUrl: `/api/clinic/documents?id=${d.id}&download=1`,
            })),
        }));

      return NextResponse.json({ entries });
    }

    if (scope === "pending_payment") {
      const { data: all } = await svc
        .from("appointments")
        .select("*, patients(full_name), patient_documents(*)")
        .eq("doctor_id", doctorId)
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: true });

      const pending = (all ?? [])
        .filter((apt) =>
          appointmentNeedsDoctorPaymentReviewFromDbRow(apt as never, {
            receiptDocumentCount: (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((apt as any).patient_documents ?? []) as Array<{ document_type?: string }>
            ).filter((d) => d.document_type === "payment_receipt").length,
          }),
        )
        .map((apt) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const receiptDocs = ((apt as any).patient_documents ?? []).filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (d: any) => d.document_type === "payment_receipt",
          );
          return {
            id: apt.id,
            scheduledAt: apt.scheduled_at,
            status: apt.status,
            paymentStatus: apt.payment_status,
            paymentProvider: apt.payment_provider,
            paymentReceiptAudit: apt.payment_receipt_audit,
            intakeReason: apt.intake_reason,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            patient: (apt as any).patients
              ? {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  fullName: (apt as any).patients.full_name,
                }
              : undefined,
            documentCount: receiptDocs.length,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            documents: receiptDocs.map((d: any) => ({
              id: d.id,
              fileName: d.file_name,
              uploadedAt: d.uploaded_at,
              downloadUrl: `/api/clinic/documents?id=${d.id}&download=1`,
            })),
          };
        });

      return NextResponse.json(pending);
    }

    if (scope === "month") {
      const monthParam = searchParams.get("month");
      const now = new Date();
      const monthKey =
        monthParam && /^\d{4}-\d{2}$/.test(monthParam)
          ? monthParam
          : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [yearStr, monthStr] = monthKey.split("-");
      const lastDay = new Date(Number(yearStr), Number(monthStr), 0).getDate();
      const monthStart = `${monthKey}-01T00:00:00`;
      const monthEnd = `${monthKey}-${String(lastDay).padStart(2, "0")}T23:59:59`;

      const { data: apts } = await svc
        .from("appointments")
        .select("id, scheduled_at, patient_id")
        .eq("doctor_id", doctorId)
        .neq("status", "cancelled")
        .gte("scheduled_at", monthStart)
        .lte("scheduled_at", monthEnd)
        .order("scheduled_at", { ascending: true });

      const byDate = new Map<string, { count: number; patientIds: Set<string> }>();
      for (const apt of apts ?? []) {
        const dateKey = localDateKeyFromIso(apt.scheduled_at);
        const entry = byDate.get(dateKey) ?? { count: 0, patientIds: new Set<string>() };
        entry.count += 1;
        entry.patientIds.add(apt.patient_id);
        byDate.set(dateKey, entry);
      }

      const days = Array.from(byDate.entries()).map(([date, entry]) => ({
        date,
        count: entry.count,
        patientCount: entry.patientIds.size,
      }));

      return NextResponse.json({ days });
    }

    if (scope === "day") {
      const dateKey = searchParams.get("date");
      if (!dateKey) {
        return NextResponse.json({ error: "Falta el parámetro date" }, { status: 400 });
      }

      const { data: apts } = await svc
        .from("appointments")
        .select("*, patients(id, full_name, email, phone, profile_photo_url)")
        .eq("doctor_id", doctorId)
        .neq("status", "cancelled")
        .gte("scheduled_at", `${dateKey}T00:00:00`)
        .lte("scheduled_at", `${dateKey}T23:59:59`)
        .order("scheduled_at", { ascending: true });

      const appointments = (apts ?? []).map((apt) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const patient = (apt as any).patients;
        return {
          ...apt,
          patient: patient
            ? {
                id: patient.id,
                fullName: patient.full_name,
                email: patient.email,
                phone: patient.phone,
                profilePhotoUrl: patient.profile_photo_url,
              }
            : undefined,
        };
      });

      return NextResponse.json({ appointments });
    }

    const todayKey = localDateKeyFromDate(new Date());
    const horizonKey = addDaysToDateKey(todayKey, 60);

    let dbQuery = svc
      .from("appointments")
      .select("*, patients(id, full_name, email, phone, profile_photo_url), patient_documents(id)")
      .eq("doctor_id", doctorId);

    if (scope === "queue") {
      // A patient who is actively waiting or in consultation must always
      // show up regardless of their original scheduled date — only merely
      // "scheduled" (not yet arrived) turnos are restricted to today+.
      dbQuery = dbQuery
        .in("status", ["scheduled", "waiting", "in_consultation"])
        .or(
          `scheduled_at.gte.${todayKey}T00:00:00,status.in.(waiting,in_consultation)`,
        );
    } else {
      dbQuery = dbQuery.neq("status", "cancelled");
      if (scope === "today" || scope === "active") {
        dbQuery = dbQuery
          .gte("scheduled_at", `${todayKey}T00:00:00`)
          .lte("scheduled_at", `${todayKey}T23:59:59`);
      } else if (scope === "upcoming") {
        dbQuery = dbQuery
          .gte("scheduled_at", `${todayKey}T00:00:00`)
          .lte("scheduled_at", `${horizonKey}T23:59:59`);
      }
    }

    const orderBy =
      scope === "queue"
        ? { column: "queue_position" as const, ascending: true }
        : { column: "scheduled_at" as const, ascending: true };

    const { data: rawApts } = await dbQuery.order(orderBy.column, {
      ascending: orderBy.ascending,
    });

    const filtered = (rawApts ?? []).filter((a) => {
      if (scope === "queue") {
        return isPaymentConfirmed(a as never);
      }
      if (scope === "active") {
        return (
          ["scheduled", "waiting", "in_consultation"].includes(a.status) &&
          isPaymentConfirmed(a as never)
        );
      }
      if (scope === "upcoming") {
        return isPaymentConfirmed(a as never);
      }
      return true;
    });

    const deduped = dedupeDoctorAppointments(filtered).map((apt) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patient = (apt as any).patients;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aptDocs = (apt as any).patient_documents ?? [];
      return {
        ...apt,
        patient: patient
          ? {
              id: patient.id,
              fullName: patient.full_name,
              email: patient.email,
              phone: patient.phone,
              profilePhotoUrl: patient.profile_photo_url,
            }
          : undefined,
        documentCount: aptDocs.length,
        hasNewDocuments: aptDocs.length > 0,
      };
    });

    return NextResponse.json(deduped);
  }

  return NextResponse.json({ error: "Parámetro requerido" }, { status: 400 });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (isLocalMode()) {
    return handleAppointmentsPostLocal(request);
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  if (user.role !== "patient") {
    return NextResponse.json(
      { error: "Debe iniciar sesión como paciente" },
      { status: 401 },
    );
  }

  const { doctorId, scheduledAt, paymentMethod, shareHealthProfile, receipt, intakeReason, studyFiles, appointmentType } =
    await request.json();

  const type = (appointmentType === 'in_person' ? 'in_person' : 'virtual') as 'virtual' | 'in_person';

  if (!doctorId) {
    return NextResponse.json({ error: "Médico requerido" }, { status: 400 });
  }

  // Fetch doctor (professional) + office settings (service client — patient RLS cannot read professionals)
  const bookable = await getBookableProfessional(doctorId);
  if (!bookable) {
    return NextResponse.json(
      { error: "Médico no disponible" },
      { status: 404 },
    );
  }

  const { professional, officeSettings } = bookable;

  // Fetch in_person_availability if booking presencial appointment
  let inPersonAvailability: { availability?: DoctorAvailability; location_info?: Record<string, unknown> } | null = null;
  if (type === 'in_person') {
    const { data } = await supabase
      .from('in_person_availability')
      .select('availability, location_info, enabled')
      .eq('professional_id', doctorId)
      .maybeSingle();
    inPersonAvailability = data;

    if (!inPersonAvailability?.enabled) {
      return NextResponse.json(
        { error: 'El médico no atiende pacientes de forma presencial' },
        { status: 404 },
      );
    }
  }

  // Find the patient row for this auth user
  const { data: patientRow } = await supabase
    .from("patients")
    .select("id, org_id, full_name, email")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!patientRow) {
    return NextResponse.json(
      {
        error: "Tu sesión no coincide con un paciente registrado. Cerrá sesión e ingresá de nuevo.",
      },
      { status: 404 },
    );
  }

  // Build doctor-like object for business logic helpers
  const doctorForLogic = {
    id: professional.id,
    fullName: professional.full_name,
    email: professional.email,
    payment: officeSettings?.payment,
    reminderSettings: officeSettings?.reminder_settings,
    availability: officeSettings?.availability,
  };

  const requiresPayment = doctorRequiresPayment(doctorForLogic as never);
  const usesMercadoPago =
    paymentMethod === "mercadopago" && doctorUsesMercadoPago(doctorForLogic as never);

  const when = scheduledAt ? new Date(scheduledAt) : null;
  if (!when || Number.isNaN(when.getTime())) {
    return NextResponse.json(
      { error: "Horario de turno inválido" },
      { status: 400 },
    );
  }

  // A patient can't have two active appointments (with any doctor) less than
  // 1 hour apart — booking exactly 1 hour apart is still allowed.
  const oneHourMs = 60 * 60 * 1000;
  const windowStart = new Date(when.getTime() - oneHourMs).toISOString();
  const windowEnd = new Date(when.getTime() + oneHourMs).toISOString();

  const { data: conflictingAppointments } = await supabase
    .from("appointments")
    .select("id")
    .eq("patient_id", patientRow.id)
    .in("status", ["scheduled", "waiting", "in_consultation"])
    .gt("scheduled_at", windowStart)
    .lt("scheduled_at", windowEnd);

  if (conflictingAppointments && conflictingAppointments.length > 0) {
    return NextResponse.json(
      {
        error:
          "Ya tenés un turno reservado a menos de 1 hora de este horario. Elegí otro horario.",
      },
      { status: 409 },
    );
  }

  const availability = doctorForLogic.availability ?? DEFAULT_AVAILABILITY;

  let validatedReceipt:
    | { fileName?: string; mimeType?: string; dataBase64?: string }
    | undefined;
  let receiptAudit: ReturnType<typeof buildPaymentReceiptAudit> | undefined;
  let transferPaymentValidated = false;

  if (requiresPayment && !usesMercadoPago) {
    const receiptPayload = receipt as
      | { fileName?: string; mimeType?: string; dataBase64?: string }
      | undefined;
    if (!receiptPayload?.dataBase64?.trim()) {
      return NextResponse.json(
        {
          error: "Subí el comprobante de transferencia para confirmar el turno",
          requiresReceipt: true,
        },
        { status: 402 },
      );
    }

    const fee = doctorForLogic.payment?.consultationFee ?? 0;
    const validation = await validatePaymentReceipt({
      imageBase64: receiptPayload.dataBase64,
      mimeType: receiptPayload.mimeType || "image/jpeg",
      fileName: receiptPayload.fileName,
      doctorName: professional.full_name,
      doctorAlias: doctorForLogic.payment?.alias,
      doctorCbu: doctorForLogic.payment?.cbu,
      beneficiaryName: doctorForLogic.payment?.beneficiaryName,
      expectedAmount: fee,
      currency: doctorForLogic.payment?.currency ?? "ARS",
      appointmentDateIso: when.toISOString(),
      slotDurationMinutes: availability.slotDurationMinutes,
    });

    transferPaymentValidated = validation.valid;
    receiptAudit = buildPaymentReceiptAudit(
      validation,
      fee,
      doctorForLogic.payment?.currency ?? "ARS",
    );
    validatedReceipt = receiptPayload;
  }

  // Validate against appropriate availability (virtual or presencial)
  const scheduleToValidate = type === 'in_person'
    ? (inPersonAvailability?.availability ?? DEFAULT_AVAILABILITY)
    : availability;

  if (!appointmentMatchesScheduleGrid(when.toISOString(), scheduleToValidate)) {
    return NextResponse.json(
      { error: "El horario elegido está fuera de la agenda del médico" },
      { status: 400 },
    );
  }

  // Check slot availability and bidirectional conflicts (presencial vs virtual)
  const slotKey = slotKeyFromIso(when.toISOString());
  const { data: existingApts } = await supabase
    .from("appointments")
    .select("id, scheduled_at, status, appointment_type")
    .eq("doctor_id", doctorId)
    .neq("status", "cancelled");

  // For presencial: check overlap with ANY existing appointment (virtual or presencial)
  // For virtual: only check overlap with other virtuals
  const aptDuration = type === 'in_person'
    ? (inPersonAvailability?.availability?.slotDurationMinutes ?? 30)
    : (availability.slotDurationMinutes ?? 30);

  const conflictingApt = (existingApts ?? []).find((a) => {
    if (type === 'in_person') {
      // Presencial: check overlap with BOTH virtual and presencial
      return appointmentRangeOverlaps(
        new Date(a.scheduled_at),
        30, // assume standard 30min for existing apt
        when,
        aptDuration,
      );
    } else {
      // Virtual: check overlap only with other virtuals
      if (a.appointment_type === 'in_person') return false;
      return slotKeyFromIso(a.scheduled_at) === slotKey;
    }
  });

  if (conflictingApt) {
    const msg = type === 'in_person'
      ? "No podés asignar un turno presencial en ese horario: conflicto con turno existente"
      : "Ese horario ya está reservado";
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const whenDateKey = localDateKeyFromIso(when.toISOString());
  const queueToday = (existingApts ?? []).filter(
    (a) =>
      localDateKeyFromIso(a.scheduled_at) === whenDateKey &&
      isPaymentConfirmed(a as never),
  ).length;

  const paymentStatus =
    !requiresPayment ? "waived" : usesMercadoPago ? "pending" : transferPaymentValidated ? "confirmed" : "pending";
  const now = new Date().toISOString();

  const tokenExpires = new Date(when.getTime() + 24 * 60 * 60 * 1000);

  const { data: apt, error: insertError } = await createAppointment(supabase, {
    org_id: professional.org_id ?? patientRow.org_id,
    doctor_id: doctorId,
    professional_id: doctorId,
    patient_id: patientRow.id,
    scheduled_at: when.toISOString(),
    appointment_date: when.toISOString(),
    status: "scheduled",
    queue_position: queueToday + 1,
    jitsi_room_id: type === 'virtual' ? `clinica-${doctorId.slice(-8)}-${Date.now()}` : null,
    access_token: randomUUID(),
    token_expires_at: tokenExpires.toISOString(),
    payment_status: paymentStatus as "waived" | "pending" | "confirmed",
    payment_provider: usesMercadoPago ? "mercadopago" : "transfer",
    payment_confirmed_at: paymentStatus === "confirmed" ? now : null,
    share_health_profile: !!shareHealthProfile,
    intake_reason: intakeReason ? String(intakeReason).slice(0, 4000) : null,
    payment_receipt_audit: receiptAudit ?? null,
    appointment_type: type,
  });

  if (insertError || !apt) {
    return NextResponse.json(
      { error: insertError?.message ?? "Error al crear turno" },
      { status: 500 },
    );
  }

  // Attach receipt document if validated
  if (validatedReceipt?.dataBase64) {
    try {
      const buffer = Buffer.from(
        validatedReceipt.dataBase64.replace(/^data:[^;]+;base64,/, ""),
        "base64",
      );
      await attachDocumentToAppointment(
        apt.id,
        patientRow.id,
        patientRow.org_id,
        validatedReceipt.fileName || "comprobante.jpg",
        validatedReceipt.mimeType || "image/jpeg",
        buffer,
      );
    } catch (err) {
      console.error("[appointments] receipt attach failed", err);
    }
  }

  // Attach study files
  const studies = Array.isArray(studyFiles) ? studyFiles : [];
  for (const study of studies) {
    if (!study?.dataBase64) continue;
    try {
      const buffer = Buffer.from(
        String(study.dataBase64).replace(/^data:[^;]+;base64,/, ""),
        "base64",
      );
      await attachDocumentToAppointment(
        apt.id,
        patientRow.id,
        patientRow.org_id,
        study.fileName || "estudio.pdf",
        study.mimeType || "application/pdf",
        buffer,
      );
    } catch (err) {
      console.error("[appointments] study attach failed", err);
    }
  }

  const baseUrl = appBaseUrl();
  const waitingRoomUrl = `/paciente/sala/${apt.access_token}`;

  if (usesMercadoPago) {
    try {
      // Booked from the portal's dialog (logged-in patient) — return to the
      // portal so the same WaitingRoomModal used for no-payment bookings
      // opens, instead of navigating away to the standalone sala page.
      const checkout = await buildCheckoutForAppointment(apt.id, { returnTo: "portal" });
      if (!checkout) {
        await cancelAppointment(supabase, apt.id, patientRow.org_id);
        return NextResponse.json(
          { error: "No se pudo iniciar el pago con Mercado Pago" },
          { status: 500 },
        );
      }
      return NextResponse.json({
        appointment: apt,
        waitingRoomUrl,
        checkoutUrl: checkout.checkoutUrl,
        paymentProvider: "mercadopago",
        requiresPayment: true,
      });
    } catch (err) {
      await cancelAppointment(supabase, apt.id, patientRow.org_id);
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Error al crear checkout de Mercado Pago",
        },
        { status: 502 },
      );
    }
  }

  const scheduledLabel = formatAppointmentLabelFromIso(when.toISOString());

  let reminderNote: string | undefined;
  if (doctorForLogic.reminderSettings?.enabled) {
    reminderNote = `Te enviaremos un recordatorio ${formatReminderLabel(
      doctorForLogic.reminderSettings.minutesBefore ?? 1440,
    )} del turno a ${patientRow.email}.`;
  }

  if (type === 'in_person') {
    const locationInfo = inPersonAvailability?.location_info as Record<string, string> | undefined;
    // TODO: implement sendInPersonConfirmationEmail
    // For now, send standard confirmation (email template can be added later)
    sendAppointmentConfirmationEmail({
      patientEmail: patientRow.email,
      patientName: patientRow.full_name,
      doctorName: professional.full_name,
      scheduledAt: scheduledLabel,
      waitingRoomUrl: patientLoginUrl(baseUrl),
      reminderNote,
    }).catch((err) => console.error("[Email] confirmation failed", err));
  } else {
    sendAppointmentConfirmationEmail({
      patientEmail: patientRow.email,
      patientName: patientRow.full_name,
      doctorName: professional.full_name,
      scheduledAt: scheduledLabel,
      waitingRoomUrl: patientLoginUrl(baseUrl),
      reminderNote,
    }).catch((err) => console.error("[Email] confirmation failed", err));
  }

  const paymentPendingReview =
    requiresPayment && !usesMercadoPago && !transferPaymentValidated;
  if (paymentPendingReview) {
    await notifyDoctorTransferPendingReview({
      doctorId: professional.id,
      orgId: professional.org_id,
      appointmentId: apt.id,
      patientName: patientRow.full_name,
    });
  }

  return NextResponse.json({
    appointment: apt,
    waitingRoomUrl,
    accessToken: apt.access_token,
    requiresPayment,
    paymentProvider: "transfer",
    paymentPendingReview,
  });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

async function deleteAppointmentForPatient(
  aptId: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  const svc = await createServiceClient();
  const { data: deleted, error } = await svc
    .from("appointments")
    .delete()
    .eq("id", aptId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message, status: 400 };
  }
  if (!deleted) {
    return {
      error: "No se pudo eliminar el turno",
      status: 500,
    };
  }
  return { ok: true };
}

export async function PATCH(request: NextRequest) {
  if (isLocalMode()) {
    return handleAppointmentsPatchLocal(request);
  }

  const body = await request.json();
  const {
    appointmentId,
    status,
    accessToken,
    doctorId,
    action,
    intakeReason,
    transcription,
    clinicalNotes,
  } = body;

  // A valid, non-expired access_token is sufficient credential to confirm
  // payment for THIS one appointment — no login required (magic-link style).
  // Every other action below still requires a real session via requireAuth().
  if (action === "confirmPayment" && accessToken) {
    const publicApt = await resolveAppointmentByAccessToken(accessToken);
    if (publicApt) {
      if (
        publicApt.payment_status === "confirmed" ||
        publicApt.payment_status === "waived"
      ) {
        return NextResponse.json(publicApt);
      }
      if (isStrictPaymentValidation()) {
        return NextResponse.json(
          {
            error:
              "En producción debés validar el comprobante con IA o pedir al médico que confirme el pago.",
          },
          { status: 403 },
        );
      }
      const updated = await confirmAppointmentPaymentAndNotify(publicApt.id);
      return NextResponse.json(updated ?? publicApt);
    }
  }

  // Same token-as-credential bypass for saving the intake reason — this is
  // the only other patient-facing write reachable from the magic-link screen
  // before a session exists (Motivo de consulta on the waiting-room card).
  if (action === "saveIntake" && accessToken) {
    const publicApt = await resolveAppointmentByAccessToken(accessToken);
    if (publicApt) {
      const svc = await createServiceClient();
      const { data: updated } = await updateAppointment(
        svc,
        publicApt.id,
        publicApt.org_id,
        { intake_reason: String(intakeReason ?? "").slice(0, 4000) },
      );
      return NextResponse.json(updated);
    }
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  if (action === "saveIntake" && accessToken) {
    const { data: apt } = await getAppointmentByToken(supabase, accessToken);
    if (!apt) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 },
      );
    }
    const { data: updated } = await updateAppointment(
      supabase,
      apt.id,
      apt.org_id,
      { intake_reason: String(intakeReason ?? "").slice(0, 4000) },
    );
    return NextResponse.json(updated);
  }

  if (action === "patientCancelAppointment" && accessToken) {
    const { data: apt } = await getAppointmentByToken(supabase, accessToken);
    if (!apt) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 },
      );
    }
    if (user.role === "patient") {
      const { data: patientRow } = await supabase
        .from("patients")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (patientRow && patientRow.id !== apt.patient_id) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }
    if (apt.status !== "scheduled") {
      return NextResponse.json(
        { error: "Este turno ya no se puede cancelar desde acá" },
        { status: 400 },
      );
    }
    if (apt.payment_status !== "pending") {
      return NextResponse.json(
        { error: "Solo podés cancelar turnos con pago pendiente" },
        { status: 400 },
      );
    }
    const { data: updated } = await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        payment_status: "pending", // payment stays as pending (rejected handled at business layer)
        updated_at: new Date().toISOString(),
      })
      .eq("id", apt.id)
      .select()
      .single();
    return NextResponse.json(updated);
  }

  if (action === "patientRemoveAppointment" && accessToken) {
    const { data: apt } = await getAppointmentByToken(supabase, accessToken);
    if (!apt) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 },
      );
    }
    if (user.role === "patient") {
      const { data: patientRow } = await supabase
        .from("patients")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (patientRow && patientRow.id !== apt.patient_id) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }
    if (["waiting", "in_consultation"].includes(apt.status)) {
      return NextResponse.json(
        { error: "No podés eliminar un turno en curso" },
        { status: 400 },
      );
    }
    const result = await deleteAppointmentForPatient(apt.id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "patientDeleteCancelledAppointment" && accessToken) {
    const { data: apt } = await getAppointmentByToken(supabase, accessToken);
    if (!apt) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 },
      );
    }
    if (user.role === "patient") {
      const { data: patientRow } = await supabase
        .from("patients")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (patientRow && patientRow.id !== apt.patient_id) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }
    if (apt.status !== "cancelled") {
      return NextResponse.json(
        { error: "Solo se pueden eliminar turnos cancelados" },
        { status: 400 },
      );
    }
    const result = await deleteAppointmentForPatient(apt.id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "confirmPayment" && accessToken) {
    const { data: apt } = await getAppointmentByToken(supabase, accessToken);
    if (!apt) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 },
      );
    }
    if (user.role === "patient") {
      const { data: patientRow } = await supabase
        .from("patients")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (patientRow && patientRow.id !== apt.patient_id) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }
    if (apt.payment_status === "confirmed" || apt.payment_status === "waived") {
      return NextResponse.json(apt);
    }
    if (user.role === "patient" && isStrictPaymentValidation()) {
      return NextResponse.json(
        {
          error:
            "En producción debés validar el comprobante con IA o pedir al médico que confirme el pago.",
        },
        { status: 403 },
      );
    }
    const updated = await confirmAppointmentPaymentAndNotify(apt.id);
    return NextResponse.json(updated ?? apt);
  }

  if (action === "doctorConfirmPayment" && appointmentId) {
    if (user.role === "patient") {
      return NextResponse.json(
        { error: "Solo el médico puede confirmar" },
        { status: 403 },
      );
    }
    const { data: apt } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .maybeSingle();
    if (!apt) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 },
      );
    }
    const updated = await confirmAppointmentPaymentAndNotify(appointmentId);
    return NextResponse.json(updated ?? apt);
  }

  if (action === "doctorRejectPayment" && appointmentId) {
    if (user.role === "patient") {
      return NextResponse.json(
        { error: "Solo el médico puede rechazar" },
        { status: 403 },
      );
    }
    const svc = await createServiceClient();
    const { data: apt, error: fetchErr } = await svc
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .maybeSingle();
    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 400 });
    }
    if (!apt) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 },
      );
    }
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const { data: updated, error: updateErr } = await svc
      .from("appointments")
      .update({
        payment_status: "pending",
        status: "cancelled",
        cancelled_by: "doctor",
        cancelled_at: new Date().toISOString(),
        payment_receipt_audit: {
          ...((apt.payment_receipt_audit as Record<string, unknown>) ?? {}),
          rejectionReason: reason || "Rechazado por el médico",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", apt.id)
      .select()
      .single();
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }
    return NextResponse.json({
      ...updated,
      requiresRefund: apt.payment_status === "confirmed",
      paymentProvider: apt.payment_provider,
    });
  }

  if (action === "doctorCancelAppointments" && Array.isArray(body.appointmentIds)) {
    if (user.role === "patient") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const me = await resolveProfessional(authResult);
    if (!me) {
      return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
    }

    const svc = await createServiceClient();
    const { data: apts, error: fetchErr } = await svc
      .from("appointments")
      .select("*")
      .in("id", body.appointmentIds)
      .eq("doctor_id", me.id)
      .neq("status", "cancelled");
    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 400 });
    }

    const results = [];
    for (const apt of apts ?? []) {
      const { error: cancelError } = await svc
        .from("appointments")
        .update({
          status: "cancelled",
          cancelled_by: "doctor",
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", apt.id);
      results.push(
        cancelError
          ? { id: apt.id, ok: false, error: cancelError.message }
          : {
              id: apt.id,
              ok: true,
              requiresRefund: apt.payment_status === "confirmed",
              paymentProvider: apt.payment_provider,
              mercadopagoPaymentId: apt.mercadopago_payment_id,
            },
      );
    }
    return NextResponse.json({ results });
  }

  // Hard-delete a turno that is already cancelled — doctorCancelAppointments
  // only touches turnos still active, so a row that was already rejected
  // (status already "cancelled") needs this instead to actually disappear.
  if (action === "doctorDeleteAppointment" && appointmentId) {
    if (user.role === "patient") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const me = await resolveProfessional(authResult);
    if (!me) {
      return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
    }

    const svc = await createServiceClient();
    const { data: apt, error: fetchErr } = await svc
      .from("appointments")
      .select("id, status")
      .eq("id", appointmentId)
      .eq("doctor_id", me.id)
      .maybeSingle();
    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 400 });
    }
    if (!apt) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    if (apt.status !== "cancelled") {
      return NextResponse.json(
        { error: "Solo se pueden eliminar turnos cancelados" },
        { status: 400 },
      );
    }

    const { error: deleteError } = await svc
      .from("appointments")
      .delete()
      .eq("id", appointmentId);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "refundAppointmentMercadoPago" && appointmentId) {
    if (user.role === "patient") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const result = await refundAppointmentViaMercadoPago(appointmentId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result.appointment);
  }

  if (action === "markAppointmentRefundedManually" && appointmentId) {
    if (user.role === "patient") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const result = await markAppointmentRefundedManually(appointmentId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result.appointment);
  }

  if (action === "clearStuck" && doctorId) {
    const { data: stuck } = await supabase
      .from("appointments")
      .select("id")
      .eq("doctor_id", doctorId)
      .eq("status", "in_consultation");

    let cleared = 0;
    for (const a of stuck ?? []) {
      await supabase
        .from("appointments")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", a.id);
      cleared++;
    }
    return NextResponse.json({ ok: true, cleared });
  }

  // Generic status update
  const { data: apt } = appointmentId
    ? await supabase
        .from("appointments")
        .select("*")
        .eq("id", appointmentId)
        .maybeSingle()
    : await getAppointmentByToken(supabase, accessToken);

  if (!apt) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  if (status) {
    await updateAppointment(supabase, apt.id, apt.org_id, { status });

    if (status === "completed" && clinicalNotes?.trim()) {
      const { data: professional } = await supabase
        .from("professionals")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (professional) {
        await createNote(supabase, {
          appointment_id: apt.id,
          org_id: apt.org_id,
          doctor_id: professional.id,
          content: clinicalNotes.trim(),
        });
      }

      await appendConsultationArtifacts(null as never, apt.id, {
        transcription,
        clinicalNotes,
      });
    }
  }

  const { data: updated } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", apt.id)
    .maybeSingle();

  return NextResponse.json(updated);
}
