import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
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
} from "@/lib/clinic/schedule";
import {
  isPaymentConfirmed,
  doctorRequiresPayment,
  doctorUsesMercadoPago,
} from "@/lib/clinic/payment";
import { isStrictPaymentValidation } from "@/lib/clinic/payment-validation";
import { orgHasMercadoPagoConnection } from "@/lib/clinic/db/payments";
import { sendAppointmentConfirmationEmail } from "@/lib/email/resend";
import { formatReminderLabel } from "@/lib/email/reminder-label";
import { buildCheckoutForAppointment } from "@/lib/mercadopago/checkout";
import {
  appBaseUrl,
  confirmAppointmentPaymentAndNotify,
} from "@/lib/clinic/appointment-payment";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { appendConsultationArtifacts } from "@/lib/clinic/finalize-appointment";
import { validatePaymentReceipt } from "@/lib/ai/payment-receipt";
import { notifyDoctorTransferPendingReview } from "@/lib/clinic/doctor-notifications";
import {
  receiptDateOlderThanBooking,
  resolveCobroReceiptFields,
} from "@/lib/clinic/cobros-receipt";
import { buildPaymentReceiptAudit } from "@/lib/clinic/payment-receipt-audit";
import { attachDocumentToAppointment } from "@/lib/clinic/appointment-documents";
import { appointmentNeedsDoctorPaymentReviewFromDbRow } from "@/lib/clinic/payment";
import { isLocalMode } from "@/lib/clinic/config";
import { handleAppointmentsGetLocal } from "@/lib/clinic/appointments-local-get";
import { handleAppointmentsPostLocal } from "@/lib/clinic/appointments-local-post";

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

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId");
  const patientId = searchParams.get("patientId");
  const token = searchParams.get("token");

  if (token) {
    const { data: apt } = await getAppointmentByToken(supabase, token);
    if (!apt) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 },
      );
    }

    const [{ data: patient }, { data: professional }, { count: waitingCount }, { data: docs }] =
      await Promise.all([
        supabase.from("patients").select("*").eq("id", apt.patient_id).maybeSingle(),
        supabase
          .from("professionals")
          .select("*, office_settings(*)")
          .eq("id", apt.doctor_id)
          .maybeSingle(),
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("doctor_id", apt.doctor_id)
          .in("status", ["waiting", "in_consultation"]),
        supabase
          .from("patient_documents")
          .select("*")
          .eq("appointment_id", apt.id),
      ]);

    const { count: aheadCount } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", apt.doctor_id)
      .in("status", ["waiting", "in_consultation"])
      .lt("queue_position", apt.queue_position);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const officeSettingsPayment = ((professional as any)?.office_settings?.payment ?? {}) as Record<
      string,
      unknown
    >;
    const consultationFee =
      typeof officeSettingsPayment.consultationFee === "number"
        ? officeSettingsPayment.consultationFee
        : 0;
    const orgConnected = professional?.org_id
      ? await orgHasMercadoPagoConnection(professional.org_id)
      : false;
    const doctorPayment = {
      consultationFee,
      currency: (officeSettingsPayment.currency as string) ?? "ARS",
      alias: officeSettingsPayment.alias as string | undefined,
      cbu: officeSettingsPayment.cbu as string | undefined,
      paymentInstructions: officeSettingsPayment.paymentInstructions as string | undefined,
      qrImageData: officeSettingsPayment.qrImageData as string | undefined,
      mercadopagoReady: orgConnected && consultationFee > 0,
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
      queuePosition: (aheadCount ?? 0) + 1,
      totalWaiting: waitingCount ?? 0,
      strictPaymentValidation: isStrictPaymentValidation(),
      documents: (docs ?? []).map((d) => ({
        id: d.id,
        fileName: d.file_name,
        uploadedAt: d.uploaded_at,
        mimeType: d.mime_type,
        downloadUrl: `/api/clinic/documents?id=${d.id}&download=1`,
      })),
    });
  }

  if (patientId) {
    // patientId here is the auth/profile id (as sent by the client session),
    // not the patients-table row id that appointments.patient_id stores.
    const { data: patientRow, error: patientRowError } = await supabase
      .from("patients")
      .select("id, org_id")
      .eq("profile_id", patientId)
      .maybeSingle();

    const { data: appointments, error: appointmentsError } = patientRow
      ? await supabase
          .from("appointments")
          .select(
            "*, professionals!appointments_doctor_id_fkey(full_name, specialty), patient_documents(*)",
          )
          .eq("patient_id", patientRow.id)
          .eq("org_id", patientRow.org_id)
          .order("scheduled_at", { ascending: false })
      : { data: [], error: null };

    if (searchParams.get("debug") === "1") {
      return NextResponse.json({
        authUserId: user.id,
        patientRow,
        patientRowError,
        appointmentsCount: appointments?.length ?? 0,
        appointmentsError,
      });
    }

    return NextResponse.json(
      (appointments ?? []).map((apt) => ({
        id: apt.id,
        scheduledAt: apt.scheduled_at,
        status: apt.status,
        accessToken: apt.access_token,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        paymentStatus: (apt as any).payment_status,
        needsReview: appointmentNeedsDoctorPaymentReviewFromDbRow(apt as never, {
          receiptDocumentCount:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((apt as any).patient_documents ?? []).length,
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        doctor: (apt as any).professionals
          ? {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              fullName: (apt as any).professionals.full_name,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              specialty: (apt as any).professionals.specialty,
            }
          : undefined,
      })),
    );
  }

  if (doctorId) {
    const scope = searchParams.get("scope") ?? "upcoming";

    if (scope === "cobros_received") {
      const { data: professional } = await supabase
        .from("professionals")
        .select("*, office_settings(*)")
        .eq("id", doctorId)
        .maybeSingle();

      const defaultAmount =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (professional?.office_settings as any)?.payment?.consultationFee ?? 0;

      const { data: confirmed } = await supabase
        .from("appointments")
        .select("*, patients(full_name), patient_documents(*)")
        .eq("doctor_id", doctorId)
        .eq("payment_status", "confirmed")
        .eq("org_id", user.org_id ?? "")
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
          documents: ((apt as any).patient_documents ?? []).map((d: any) => ({
            id: d.id,
            fileName: d.file_name,
            downloadUrl: `/api/clinic/documents?id=${d.id}&download=1`,
          })),
        };
      });

      return NextResponse.json({ entries });
    }

    if (scope === "payment_ledger") {
      const { data: ledger } = await supabase
        .from("appointments")
        .select("*, patients(full_name), patient_documents(*)")
        .eq("doctor_id", doctorId)
        .eq("org_id", user.org_id ?? "")
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: false })
        .limit(50);

      const entries = (ledger ?? [])
        .filter((apt) =>
          appointmentNeedsDoctorPaymentReviewFromDbRow(apt as never, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            receiptDocumentCount: ((apt as any).patient_documents ?? []).length,
          }) ||
          apt.payment_status === "confirmed" ||
          apt.payment_receipt_audit,
        )
        .map((apt) => ({
          id: apt.id,
          scheduledAt: apt.scheduled_at,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          patientName: (apt as any).patients?.full_name ?? "Paciente",
          paymentStatus: apt.payment_status,
          paymentProvider: apt.payment_provider,
          audit: apt.payment_receipt_audit,
          needsReview: appointmentNeedsDoctorPaymentReviewFromDbRow(apt as never, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            receiptDocumentCount: ((apt as any).patient_documents ?? []).length,
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          documents: ((apt as any).patient_documents ?? []).map((d: any) => ({
            id: d.id,
            fileName: d.file_name,
            downloadUrl: `/api/clinic/documents?id=${d.id}&download=1`,
          })),
        }));

      return NextResponse.json({ entries });
    }

    if (scope === "pending_payment") {
      const { data: all } = await supabase
        .from("appointments")
        .select("*, patients(full_name), patient_documents(*)")
        .eq("doctor_id", doctorId)
        .eq("org_id", user.org_id ?? "")
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: true });

      const pending = (all ?? [])
        .filter((apt) =>
          appointmentNeedsDoctorPaymentReviewFromDbRow(apt as never, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            receiptDocumentCount: ((apt as any).patient_documents ?? []).length,
          }),
        )
        .map((apt) => ({
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          documentCount: ((apt as any).patient_documents ?? []).length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          documents: ((apt as any).patient_documents ?? []).map((d: any) => ({
            id: d.id,
            fileName: d.file_name,
            uploadedAt: d.uploaded_at,
            downloadUrl: `/api/clinic/documents?id=${d.id}&download=1`,
          })),
        }));

      return NextResponse.json(pending);
    }

    // Default: upcoming / today / active
    const { data: professional } = await supabase
      .from("professionals")
      .select("*, office_settings(*)")
      .eq("id", doctorId)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const availability = (professional?.office_settings as any)?.availability ?? DEFAULT_AVAILABILITY;
    const todayKey = localDateKeyFromDate(new Date());
    const horizonKey = addDaysToDateKey(todayKey, 60);

    let dbQuery = supabase
      .from("appointments")
      .select("*, patients(id, full_name, email, phone, profile_photo_url), patient_documents(id)")
      .eq("doctor_id", doctorId)
      .eq("org_id", user.org_id ?? "")
      .neq("status", "cancelled");

    if (scope === "today" || scope === "active") {
      dbQuery = dbQuery
        .gte("scheduled_at", `${todayKey}T00:00:00`)
        .lte("scheduled_at", `${todayKey}T23:59:59`);
    } else if (scope === "upcoming") {
      dbQuery = dbQuery
        .gte("scheduled_at", `${todayKey}T00:00:00`)
        .lte("scheduled_at", `${horizonKey}T23:59:59`);
    }

    const { data: rawApts } = await dbQuery.order("scheduled_at", { ascending: true });

    const filtered = (rawApts ?? []).filter((a) => {
      if (!appointmentMatchesScheduleGrid(a.scheduled_at, availability)) return false;
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

  const { doctorId, scheduledAt, paymentMethod, shareHealthProfile, receipt, intakeReason, studyFiles } =
    await request.json();

  if (!doctorId) {
    return NextResponse.json({ error: "Médico requerido" }, { status: 400 });
  }

  // Fetch doctor (professional) + office settings
  const { data: professional } = await supabase
    .from("professionals")
    .select("*, office_settings(*)")
    .eq("id", doctorId)
    .maybeSingle();

  if (!professional || professional.subscription_status === "expired") {
    return NextResponse.json(
      { error: "Médico no disponible" },
      { status: 404 },
    );
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const officeSettings = (professional.office_settings as any) ?? {};
  const doctorForLogic = {
    id: professional.id,
    fullName: professional.full_name,
    email: professional.email,
    payment: officeSettings.payment,
    reminderSettings: officeSettings.reminder_settings,
    availability: officeSettings.availability,
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

  if (!appointmentMatchesScheduleGrid(when.toISOString(), availability)) {
    return NextResponse.json(
      { error: "El horario elegido está fuera de la agenda del médico" },
      { status: 400 },
    );
  }

  // Check slot availability
  const slotKey = slotKeyFromIso(when.toISOString());
  const { data: existingApts } = await supabase
    .from("appointments")
    .select("id, scheduled_at, status")
    .eq("doctor_id", doctorId)
    .neq("status", "cancelled");

  const slotTaken = (existingApts ?? []).some(
    (a) => slotKeyFromIso(a.scheduled_at) === slotKey,
  );
  if (slotTaken) {
    return NextResponse.json(
      { error: "Ese horario ya está reservado" },
      { status: 409 },
    );
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
    org_id: patientRow.org_id,
    doctor_id: doctorId,
    professional_id: doctorId,
    patient_id: patientRow.id,
    scheduled_at: when.toISOString(),
    appointment_date: when.toISOString(),
    status: "scheduled",
    queue_position: queueToday + 1,
    jitsi_room_id: `clinica-${doctorId.slice(-8)}-${Date.now()}`,
    access_token: randomUUID(),
    token_expires_at: tokenExpires.toISOString(),
    payment_status: paymentStatus as "waived" | "pending" | "confirmed",
    payment_provider: usesMercadoPago ? "mercadopago" : "transfer",
    payment_confirmed_at: paymentStatus === "confirmed" ? now : null,
    share_health_profile: !!shareHealthProfile,
    intake_reason: intakeReason ? String(intakeReason).slice(0, 4000) : null,
    payment_receipt_audit: receiptAudit ?? null,
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
      const checkout = await buildCheckoutForAppointment(apt.id);
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

  const scheduledLabel = format(when, "EEEE d 'de' MMMM 'a las' HH:mm 'hs'", {
    locale: es,
  });

  let reminderNote: string | undefined;
  if (doctorForLogic.reminderSettings?.enabled) {
    reminderNote = `Te enviaremos un recordatorio ${formatReminderLabel(
      doctorForLogic.reminderSettings.minutesBefore ?? 1440,
    )} del turno a ${patientRow.email}.`;
  }

  sendAppointmentConfirmationEmail({
    patientEmail: patientRow.email,
    patientName: patientRow.full_name,
    doctorName: professional.full_name,
    scheduledAt: scheduledLabel,
    waitingRoomUrl: `${baseUrl}/paciente/sala/${apt.access_token}`,
    reminderNote,
  }).catch((err) => console.error("[Email] confirmation failed", err));

  const paymentPendingReview =
    requiresPayment && !usesMercadoPago && !transferPaymentValidated;
  if (paymentPendingReview) {
    await notifyDoctorTransferPendingReview({
      doctorId: professional.id,
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

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

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
    await supabase.from("appointments").delete().eq("id", apt.id);
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
    if (user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json(
        { error: "Solo el médico puede confirmar" },
        { status: 403 },
      );
    }
    const { data: apt } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .eq("org_id", user.org_id ?? "")
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
    if (user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json(
        { error: "Solo el médico puede rechazar" },
        { status: 403 },
      );
    }
    const { data: apt } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .eq("org_id", user.org_id ?? "")
      .maybeSingle();
    if (!apt) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 },
      );
    }
    const { data: updated } = await supabase
      .from("appointments")
      .update({
        payment_status: "pending",
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", apt.id)
      .select()
      .single();
    return NextResponse.json(updated);
  }

  if (action === "clearStuck" && doctorId) {
    const { data: stuck } = await supabase
      .from("appointments")
      .select("id")
      .eq("doctor_id", doctorId)
      .eq("status", "in_consultation")
      .eq("org_id", user.org_id ?? "");

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
        .eq("org_id", user.org_id ?? "")
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
