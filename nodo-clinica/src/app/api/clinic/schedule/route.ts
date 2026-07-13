export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";

const DOCTOR_ROLES = new Set(["admin", "super_admin", "medico", "agent", "doctor"]);
import { mergeThemeSettings } from "@/lib/clinic/theme-settings";
import {
  DEFAULT_AVAILABILITY,
  getAvailableDateKeys,
  generateSlotsForDate,
  normalizeAvailability,
  localDateKeyFromIso,
  formatDateKeyShortLabel,
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
function ownPaymentForProfessional(payment?: any) {
  if (!payment) return {};
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
    hasMercadopagoToken: !!token || !!mercadopagoRefreshToken,
    mercadopagoConnected: !!(payment.mercadopagoUserId || mercadopagoRefreshToken || token),
    mercadopagoUserId: payment.mercadopagoUserId
      ? `···${payment.mercadopagoUserId.slice(-4)}`
      : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function doctorOfficePayload(professional: any, officeSettings: any) {
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
    payment: ownPaymentForProfessional(officeSettings?.payment),
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

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const own = searchParams.get("own") === "true";

  if (own) {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json(doctorOfficePayload(professional, (professional as any).office_settings));
  }

  const doctorId = searchParams.get("doctorId");
  const dateStr = searchParams.get("date");

  if (!doctorId) {
    return NextResponse.json({ error: "doctorId requerido" }, { status: 400 });
  }

  // Public endpoint — no auth required for reading schedule (patient booking)
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { supabase } = authResult;

  const { data: professional } = await supabase
    .from("professionals")
    .select("*, office_settings(*)")
    .eq("id", doctorId)
    .maybeSingle();

  if (!professional) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const officeSettings = (professional as any).office_settings;
  const availability = getAvailability(officeSettings);

  const { data: bookedApts } = await supabase
    .from("appointments")
    .select("scheduled_at")
    .eq("doctor_id", doctorId)
    .not("status", "in", '("cancelled","completed")');

  const allBooked = (bookedApts ?? []).map((a) => a.scheduled_at);

  if (!dateStr) {
    const dates = getAvailableDateKeys(availability, 28, allBooked).map(
      (dateKey) => ({
        date: dateKey,
        label: formatDateKeyShortLabel(dateKey),
      }),
    );
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
  const slots = generateSlotsForDate(dateStr, availability, booked);
  return NextResponse.json({
    slots,
    slotDurationMinutes: availability.slotDurationMinutes,
  });
}

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
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
    .select("id, office_settings(*)")
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
  if ((body as any).fullName !== undefined) professionalUpdate.full_name = String((body as any).fullName).trim();
  if ((body as any).licenseNumber !== undefined) professionalUpdate.license_number = String((body as any).licenseNumber).trim();
  if (Array.isArray((body as any).specialties)) professionalUpdate.specialties = (body as any).specialties;
  if (signatureText !== undefined) professionalUpdate.signature_text = signatureText;
  if (signatureImageData !== undefined) professionalUpdate.signature_image_url = signatureImageData;
  if (profilePhotoData !== undefined) professionalUpdate.profile_photo_url = profilePhotoData;
  if (bio !== undefined) professionalUpdate.bio = bio;
  if (googleCalendarId !== undefined) professionalUpdate.google_calendar_id = googleCalendarId;

  if (Object.keys(professionalUpdate).length > 0) {
    await supabase
      .from("professionals")
      .update(professionalUpdate)
      .eq("id", professional.id);
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
      { ...updateData, professional_id: professional.id },
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
  const { data: updatedProfessional } = await supabase
    .from("professionals")
    .select("*")
    .eq("id", professional.id)
    .maybeSingle();

  return NextResponse.json({ ok: true, office: doctorOfficePayload(updatedProfessional, saved) });
}
