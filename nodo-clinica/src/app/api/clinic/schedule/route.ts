export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { isLocalMode } from "@/lib/clinic/config";
import { readDb, writeDb, type DoctorPaymentSettings, type DoctorReminderSettings } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { professionalHasMercadoPagoConnection } from "@/lib/clinic/db/payments";
import { createServiceClient } from "@/lib/supabase/server";
import { isUnassignedSpecialty } from "@/lib/clinic/unassigned-specialty";

const DOCTOR_ROLES = new Set(["admin", "super_admin", "medico", "agent", "doctor"]);
import { mergeThemeSettings } from "@/lib/clinic/theme-settings";
import {
  DEFAULT_AVAILABILITY,
  getCalendarDayStates,
  getAllSlotsForDate,
  normalizeAvailability,
  localDateKeyFromIso,
  type DoctorAvailability,
} from "@/lib/clinic/schedule";

// ── Helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAvailability(officeSettings: any) {
  const base = officeSettings?.availability ?? DEFAULT_AVAILABILITY;
  return normalizeAvailability({
    ...base,
    blockedDates: base.blockedDates ?? [],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ownPaymentForProfessional(payment?: any, orgConnected = false) {
  if (!payment) {
    return { mercadopagoConnected: orgConnected, hasMercadopagoToken: orgConnected };
  }
  const {
    mercadopagoAccessToken,
    mercadopagoRefreshToken,
    mercadopagoOAuthPending,
    ...rest
  } = payment;
  const token = mercadopagoAccessToken?.trim();
  return {
    ...rest,
    mercadopagoAccessToken: token ? `····${token.slice(-4)}` : "",
    hasMercadopagoToken: !!token || !!mercadopagoRefreshToken || orgConnected,
    mercadopagoConnected:
      !!(payment.mercadopagoUserId || mercadopagoRefreshToken || token) || orgConnected,
    mercadopagoUserId: payment.mercadopagoUserId
      ? `···${payment.mercadopagoUserId.slice(-4)}`
      : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function doctorOfficePayload(professional: any, officeSettings: any, orgConnected = false) {
  const availability = getAvailability(officeSettings);
  return {
    availability,
    fullName: professional?.full_name ?? "",
    licenseNumber: professional?.license_number ?? "",
    specialties: Array.isArray(professional?.specialties)
      ? professional.specialties
      : professional?.specialty
        ? [professional.specialty]
        : [],
    signatureText: professional?.signature_text ?? "",
    signatureImageData: professional?.signature_image_url ?? "",
    profilePhotoData: professional?.profile_photo_url ?? "",
    bio: professional?.bio ?? "",
    payment: ownPaymentForProfessional(officeSettings?.payment, orgConnected),
    reminderSettings: officeSettings?.reminder_settings ?? {
      enabled: false,
      minutesBefore: 1440,
    },
    googleCalendarId: professional?.google_calendar_id ?? "",
    blockedDates: availability.blockedDates ?? [],
    themeSettings: mergeThemeSettings(officeSettings?.theme_settings),
    customStudyLabels: officeSettings?.custom_study_labels ?? [],
  };
}

function localDoctorOfficePayload(doctor: {
  fullName?: string;
  specialty?: string;
  specialties?: string[];
  licenseNumber?: string;
  availability?: DoctorAvailability;
  signatureText?: string;
  signatureImageData?: string;
  profilePhotoData?: string;
  bio?: string;
  payment?: DoctorPaymentSettings;
  reminderSettings?: DoctorReminderSettings;
  googleCalendarId?: string;
  themeSettings?: import("@/lib/clinic/theme-settings").DoctorThemeSettings;
  customStudyLabels?: string[];
}) {
  const availability = normalizeAvailability({
    ...(doctor.availability ?? DEFAULT_AVAILABILITY),
    blockedDates: doctor.availability?.blockedDates ?? [],
  });
  const payment = doctor.payment;
  const token = payment?.mercadopagoAccessToken?.trim();
  return {
    availability,
    fullName: doctor.fullName ?? "",
    licenseNumber: doctor.licenseNumber ?? "",
    specialties:
      doctor.specialties?.length
        ? doctor.specialties
        : doctor.specialty
          ? [doctor.specialty]
          : [],
    signatureText: doctor.signatureText ?? "",
    signatureImageData: doctor.signatureImageData ?? "",
    profilePhotoData: doctor.profilePhotoData ?? "",
    bio: doctor.bio ?? "",
    payment: payment
      ? {
          ...payment,
          mercadopagoAccessToken: token ? `····${token.slice(-4)}` : "",
          hasMercadopagoToken: !!token || !!payment.mercadopagoRefreshToken,
          mercadopagoConnected: !!(
            payment.mercadopagoUserId ||
            payment.mercadopagoRefreshToken ||
            token
          ),
        }
      : {},
    reminderSettings: doctor.reminderSettings ?? {
      enabled: false,
      minutesBefore: 1440,
    },
    googleCalendarId: doctor.googleCalendarId ?? "",
    blockedDates: availability.blockedDates ?? [],
    themeSettings: mergeThemeSettings(doctor.themeSettings),
    customStudyLabels: doctor.customStudyLabels ?? [],
  };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const own = searchParams.get("own") === "true";

  if (own) {
    if (isLocalMode()) {
      const session = await getSessionFromRequest(request);
      if (!session || session.role !== "doctor") {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      const db = await readDb();
      const doctor = db.doctors.find((d) => d.id === session.userId);
      if (!doctor) {
        return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      }
      return NextResponse.json(localDoctorOfficePayload(doctor));
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    if (!DOCTOR_ROLES.has(user.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const me = await resolveProfessional(authResult);
    if (!me) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    // Re-query with related office_settings using service client for full data
    const serviceClient = await (await import("@/lib/supabase/server")).createServiceClient();
    const { data: professional } = await serviceClient
      .from("professionals")
      .select("*, office_settings(*)")
      .eq("id", me.id)
      .maybeSingle();

    if (!professional) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const mpConnected = await professionalHasMercadoPagoConnection(me.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json(
      doctorOfficePayload(professional, (professional as any).office_settings, mpConnected),
    );
  }

  const doctorId = searchParams.get("doctorId");
  const dateStr = searchParams.get("date");

  if (!doctorId) {
    return NextResponse.json({ error: "doctorId requerido" }, { status: 400 });
  }

  if (isLocalMode()) {
    const db = await readDb();
    const doctor = db.doctors.find((d) => d.id === doctorId);
    if (!doctor) {
      return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
    }
    const availability = normalizeAvailability({
      ...(doctor.availability ?? DEFAULT_AVAILABILITY),
      blockedDates: doctor.availability?.blockedDates ?? [],
    });
    const allBooked = db.appointments
      .filter(
        (a) =>
          a.doctorId === doctorId &&
          !["cancelled", "completed"].includes(a.status),
      )
      .map((a) => a.scheduledAt);

    if (!dateStr) {
      const dates = getCalendarDayStates(availability, 60, allBooked);
      return NextResponse.json({
        dates,
        slotDurationMinutes: availability.slotDurationMinutes,
        blockedDates: availability.blockedDates ?? [],
      });
    }

    if ((availability.blockedDates ?? []).includes(dateStr)) {
      return NextResponse.json({
        slots: [],
        slotDurationMinutes: availability.slotDurationMinutes,
      });
    }

    const booked = allBooked.filter((t) => localDateKeyFromIso(t) === dateStr);
    const slots = getAllSlotsForDate(dateStr, availability, booked);
    return NextResponse.json({
      slots,
      slotDurationMinutes: availability.slotDurationMinutes,
    });
  }

  // Patient booking — auth required, but read via service role (RLS org_id on
  // professionals/office_settings blocks many patient JWTs even within the same clinic).
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const serviceClient = await createServiceClient();

  const { data: professional, error: professionalError } = await serviceClient
    .from("professionals")
    .select("id, org_id, specialty, subscription_status")
    .eq("id", doctorId)
    .maybeSingle();

  if (searchParams.get("debug") === "1") {
    return NextResponse.json({ professional, professionalError });
  }

  if (!professional) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  if (isUnassignedSpecialty(professional.specialty)) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const { data: officeSettings } = await serviceClient
    .from("office_settings")
    .select("availability")
    .eq("professional_id", doctorId)
    .maybeSingle();

  const availability = getAvailability(officeSettings);

  const { data: bookedApts } = await serviceClient
    .from("appointments")
    .select("scheduled_at")
    .eq("doctor_id", doctorId)
    .not("status", "in", '("cancelled","completed")');

  const allBooked = (bookedApts ?? []).map((a) => a.scheduled_at);

  if (!dateStr) {
    const dates = getCalendarDayStates(availability, 60, allBooked);
    return NextResponse.json({
      dates,
      slotDurationMinutes: availability.slotDurationMinutes,
      blockedDates: availability.blockedDates ?? [],
    });
  }

  if ((availability.blockedDates ?? []).includes(dateStr)) {
    return NextResponse.json({
      slots: [],
      slotDurationMinutes: availability.slotDurationMinutes,
    });
  }

  const booked = allBooked.filter((t) => localDateKeyFromIso(t) === dateStr);
  const slots = getAllSlotsForDate(dateStr, availability, booked);
  return NextResponse.json({
    slots,
    slotDurationMinutes: availability.slotDurationMinutes,
  });
}

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  if (isLocalMode()) {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "doctor") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      availability,
      fullName,
      licenseNumber,
      specialties,
      signatureText,
      signatureImageData,
      profilePhotoData,
      bio,
      payment,
      blockedDates,
      googleCalendarId,
      reminderSettings,
      themeSettings,
      customStudyLabels,
    } = body as {
      availability?: DoctorAvailability;
      fullName?: string;
      licenseNumber?: string;
      specialties?: string[];
      signatureText?: string;
      signatureImageData?: string;
      profilePhotoData?: string;
      bio?: string;
      payment?: DoctorPaymentSettings;
      blockedDates?: string[];
      googleCalendarId?: string;
      reminderSettings?: DoctorReminderSettings;
      themeSettings?: import("@/lib/clinic/theme-settings").DoctorThemeSettings;
      customStudyLabels?: string[];
    };

    try {
      const saved = await writeDb((db) => {
        const doctor = db.doctors.find((d) => d.id === session.userId);
        if (!doctor) throw new Error("Médico no encontrado");

        if (availability) {
          doctor.availability = normalizeAvailability({
            ...availability,
            blockedDates: blockedDates ?? availability.blockedDates ?? [],
          });
        } else if (blockedDates) {
          doctor.availability = {
            ...(doctor.availability ?? DEFAULT_AVAILABILITY),
            blockedDates,
          };
        }
        if (fullName !== undefined) doctor.fullName = String(fullName).trim();
        if (licenseNumber !== undefined) {
          doctor.licenseNumber = String(licenseNumber).trim();
        }
        if (Array.isArray(specialties)) {
          doctor.specialties = specialties.map((s) => String(s).trim()).filter(Boolean);
          if (doctor.specialties[0]) doctor.specialty = doctor.specialties[0];
        }
        if (signatureText !== undefined) doctor.signatureText = signatureText;
        if (signatureImageData !== undefined) doctor.signatureImageData = signatureImageData;
        if (profilePhotoData !== undefined) doctor.profilePhotoData = profilePhotoData;
        if (bio !== undefined) doctor.bio = bio;
        if (googleCalendarId !== undefined) doctor.googleCalendarId = googleCalendarId;
        if (reminderSettings !== undefined) doctor.reminderSettings = reminderSettings;
        if (themeSettings !== undefined) {
          doctor.themeSettings = mergeThemeSettings(themeSettings);
        }
        if (customStudyLabels !== undefined) doctor.customStudyLabels = customStudyLabels;
        if (payment !== undefined) {
          const existing = doctor.payment ?? { currency: "ARS", requirePaymentBeforeBooking: true };
          const tokenIncoming = payment.mercadopagoAccessToken?.trim();
          const keepExistingToken =
            !tokenIncoming ||
            tokenIncoming.startsWith("····") ||
            tokenIncoming.includes("····");
          const {
            mercadopagoAccessToken: _at,
            mercadopagoRefreshToken: _rt,
            mercadopagoOAuthPending: _pending,
            ...safeIncoming
          } = payment;
          doctor.payment = {
            ...existing,
            ...safeIncoming,
            mercadopagoAccessToken: keepExistingToken
              ? existing.mercadopagoAccessToken
              : tokenIncoming,
          };
        }
      });
      const doctor = saved.doctors.find((d) => d.id === session.userId);
      if (!doctor) {
        return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, office: localDoctorOfficePayload(doctor) });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Error al guardar" },
        { status: 400 },
      );
    }
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  if (!DOCTOR_ROLES.has(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const {
    availability,
    signatureText,
    signatureImageData,
    profilePhotoData,
    bio,
    payment,
    blockedDates,
    googleCalendarId,
    reminderSettings,
    themeSettings,
    customStudyLabels,
  } = body as {
    availability?: DoctorAvailability;
    signatureText?: string;
    signatureImageData?: string;
    profilePhotoData?: string;
    bio?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payment?: any;
    blockedDates?: string[];
    googleCalendarId?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reminderSettings?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    themeSettings?: any;
    customStudyLabels?: string[];
  };

  const me = await resolveProfessional(authResult);
  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const serviceClientPut = await (await import("@/lib/supabase/server")).createServiceClient();
  const { data: professional } = await serviceClientPut
    .from("professionals")
    .select("id, org_id, office_settings(*)")
    .eq("id", me.id)
    .maybeSingle();

  if (!professional) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing: any = (professional as any).office_settings ?? {};

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (availability) {
    updateData.availability = normalizeAvailability({
      ...availability,
      blockedDates: blockedDates ?? availability.blockedDates ?? [],
    });
  } else if (blockedDates) {
    updateData.availability = {
      ...(existing.availability ?? DEFAULT_AVAILABILITY),
      blockedDates,
    };
  }

  // Update profile fields on the professionals row
  const professionalUpdate: Record<string, unknown> = {};
  if ((body as { fullName?: string }).fullName !== undefined) {
    professionalUpdate.full_name = String((body as { fullName: string }).fullName).trim();
  }
  if ((body as { licenseNumber?: string }).licenseNumber !== undefined) {
    professionalUpdate.license_number = String(
      (body as { licenseNumber: string }).licenseNumber,
    ).trim();
  }
  if (Array.isArray((body as { specialties?: string[] }).specialties)) {
    const specialties = (body as { specialties: string[] }).specialties
      .map((s) => String(s).trim())
      .filter(Boolean);
    professionalUpdate.specialties = specialties;
    if (specialties[0]) {
      professionalUpdate.specialty = specialties[0];
    }
  }
  if (signatureText !== undefined) professionalUpdate.signature_text = signatureText;
  if (signatureImageData !== undefined) professionalUpdate.signature_image_url = signatureImageData;
  if (profilePhotoData !== undefined) professionalUpdate.profile_photo_url = profilePhotoData;
  if (bio !== undefined) professionalUpdate.bio = bio;
  if (googleCalendarId !== undefined) professionalUpdate.google_calendar_id = googleCalendarId;

  if (Object.keys(professionalUpdate).length > 0) {
    const { error: professionalUpdateError } = await serviceClientPut
      .from("professionals")
      .update(professionalUpdate)
      .eq("id", professional.id);
    if (professionalUpdateError) {
      return NextResponse.json(
        { error: professionalUpdateError.message ?? "Error al guardar el perfil" },
        { status: 400 },
      );
    }
  }

  if (payment !== undefined) {
    const existingPayment = existing.payment ?? {};
    const tokenIncoming = payment.mercadopagoAccessToken?.trim();
    const keepExistingToken =
      !tokenIncoming ||
      tokenIncoming.startsWith("····") ||
      tokenIncoming.includes("····");
    const {
      mercadopagoAccessToken: _at,
      mercadopagoRefreshToken: _rt,
      mercadopagoOAuthPending: _pending,
      ...safeIncoming
    } = payment;
    updateData.payment = {
      ...existingPayment,
      ...safeIncoming,
      mercadopagoAccessToken: keepExistingToken
        ? existingPayment.mercadopagoAccessToken
        : tokenIncoming,
      mercadopagoRefreshToken: existingPayment.mercadopagoRefreshToken,
      mercadopagoTokenExpiresAt: existingPayment.mercadopagoTokenExpiresAt,
      mercadopagoUserId: existingPayment.mercadopagoUserId,
      mercadopagoPublicKey: existingPayment.mercadopagoPublicKey,
      mercadopagoConnectedAt: existingPayment.mercadopagoConnectedAt,
    };
  }

  if (reminderSettings !== undefined)
    updateData.reminder_settings = reminderSettings;
  if (themeSettings !== undefined)
    updateData.theme_settings = mergeThemeSettings(themeSettings);
  // custom_study_labels is stored on professionals via study_orders route
  // (office_settings table doesn't have this column in the current schema)
  if (customStudyLabels !== undefined) {
    await supabase
      .from("professionals")
      .update({
        // Store as part of extended professional data if column exists
        // For now, we skip as the column may not be in schema
      })
      .eq("id", professional.id);
    // Keep the labels in the response payload from existing data
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: saved, error } = await (serviceClientPut as any)
    .from("office_settings")
    .upsert(
      { ...updateData, professional_id: (professional as any).id, org_id: (professional as any).org_id },
      { onConflict: "professional_id" },
    )
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Error al guardar configuración" },
      { status: 400 },
    );
  }

  // Re-fetch updated professional for signature/bio/photo fields
  const { data: updatedProfessional } = await serviceClientPut
    .from("professionals")
    .select("*")
    .eq("id", professional.id)
    .maybeSingle();

  const mpConnected = await professionalHasMercadoPagoConnection(professional.id);

  return NextResponse.json({
    ok: true,
    office: doctorOfficePayload(updatedProfessional, saved, mpConnected),
  });
}
