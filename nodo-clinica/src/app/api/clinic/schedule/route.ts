import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/clinic/local-db";

export const dynamic = "force-dynamic";
import type { DoctorPaymentSettings, DoctorReminderSettings } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
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
import { getMercadoPagoUser } from "@/lib/mercadopago/client";

function getAvailability(doctor: { availability?: DoctorAvailability }) {
  const base = doctor.availability ?? DEFAULT_AVAILABILITY;
  return normalizeAvailability({
    ...base,
    blockedDates: base.blockedDates ?? [],
  });
}

function ownPaymentForDoctor(payment?: DoctorPaymentSettings) {
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
    hasMercadopagoToken: !!token || !!payment.mercadopagoRefreshToken,
    mercadopagoConnected: !!(
      payment.mercadopagoUserId || payment.mercadopagoRefreshToken || token
    ),
    mercadopagoUserId: payment.mercadopagoUserId
      ? `···${payment.mercadopagoUserId.slice(-4)}`
      : undefined,
  };
}

function doctorOfficePayload(doctor: {
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
  const availability = getAvailability(doctor);
  return {
    availability,
    signatureText: doctor.signatureText ?? "",
    signatureImageData: doctor.signatureImageData ?? "",
    profilePhotoData: doctor.profilePhotoData ?? "",
    bio: doctor.bio ?? "",
    payment: ownPaymentForDoctor(doctor.payment),
    reminderSettings: doctor.reminderSettings ?? { enabled: false, minutesBefore: 1440 },
    googleCalendarId: doctor.googleCalendarId ?? "",
    blockedDates: availability.blockedDates ?? [],
    themeSettings: mergeThemeSettings(doctor.themeSettings),
    customStudyLabels: doctor.customStudyLabels ?? [],
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const own = searchParams.get("own") === "true";

  if (own) {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "doctor") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const db = await readDb();
    const doctor = db.doctors.find((d) => d.id === session.userId);
    if (!doctor) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(doctorOfficePayload(doctor));
  }

  const doctorId = searchParams.get("doctorId");
  const dateStr = searchParams.get("date");

  if (!doctorId) {
    return NextResponse.json({ error: "doctorId requerido" }, { status: 400 });
  }

  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const availability = getAvailability(doctor);
  const allBooked = db.appointments
    .filter(
      (a) =>
        a.doctorId === doctorId &&
        !["cancelled", "completed"].includes(a.status)
    )
    .map((a) => a.scheduledAt);

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
    return NextResponse.json({ slots: [], slotDurationMinutes: availability.slotDurationMinutes });
  }

  const booked = allBooked.filter(
    (t) => localDateKeyFromIso(t) === dateStr
  );
  const slots = generateSlotsForDate(dateStr, availability, booked);
  return NextResponse.json({ slots, slotDurationMinutes: availability.slotDurationMinutes });
}

export async function PUT(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
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
    payment?: DoctorPaymentSettings;
    blockedDates?: string[];
    googleCalendarId?: string;
    reminderSettings?: DoctorReminderSettings;
    themeSettings?: import("@/lib/clinic/theme-settings").DoctorThemeSettings;
    customStudyLabels?: string[];
  };

  try {
    const tokenToVerify =
      payment?.mercadopagoAccessToken?.trim() &&
      !payment.mercadopagoAccessToken.startsWith("····") &&
      !payment.mercadopagoAccessToken.includes("····")
        ? payment.mercadopagoAccessToken.trim()
        : undefined;

    let verifiedMpUser: { id: number } | undefined;
    if (tokenToVerify) {
      verifiedMpUser = await getMercadoPagoUser(tokenToVerify);
    }

    const saved = await writeDb((db) => {
      const doctor = db.doctors.find((d) => d.id === session.userId);
      if (!doctor) {
        throw new Error("Médico no encontrado");
      }
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
    if (signatureText !== undefined) doctor.signatureText = signatureText;
    if (signatureImageData !== undefined) doctor.signatureImageData = signatureImageData;
    if (profilePhotoData !== undefined) doctor.profilePhotoData = profilePhotoData;
    if (bio !== undefined) doctor.bio = bio;
    if (payment !== undefined) {
      const existing = doctor.payment ?? {};
      const incoming = payment;
      const tokenIncoming = incoming.mercadopagoAccessToken?.trim();
      const keepExistingToken =
        !tokenIncoming ||
        tokenIncoming.startsWith("····") ||
        tokenIncoming.includes("····");
      const {
        mercadopagoAccessToken: _at,
        mercadopagoRefreshToken: _rt,
        mercadopagoOAuthPending: _pending,
        ...safeIncoming
      } = incoming;
      doctor.payment = {
        ...existing,
        ...safeIncoming,
        mercadopagoAccessToken: keepExistingToken
          ? existing.mercadopagoAccessToken
          : tokenIncoming,
        mercadopagoRefreshToken: existing.mercadopagoRefreshToken,
        mercadopagoTokenExpiresAt: existing.mercadopagoTokenExpiresAt,
        mercadopagoUserId: verifiedMpUser
          ? String(verifiedMpUser.id)
          : existing.mercadopagoUserId,
        mercadopagoPublicKey: existing.mercadopagoPublicKey,
        mercadopagoConnectedAt: verifiedMpUser
          ? new Date().toISOString()
          : existing.mercadopagoConnectedAt,
      };
    }
    if (reminderSettings !== undefined) doctor.reminderSettings = reminderSettings;
    if (googleCalendarId !== undefined) doctor.googleCalendarId = googleCalendarId;
    if (themeSettings !== undefined) {
      doctor.themeSettings = mergeThemeSettings(themeSettings);
    }
    if (customStudyLabels !== undefined) {
      doctor.customStudyLabels = customStudyLabels
        .map((s) => String(s).trim())
        .filter(Boolean);
    }
    });

    const doctor = saved.doctors.find((d) => d.id === session.userId);
    if (!doctor) {
      return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, office: doctorOfficePayload(doctor) });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al guardar configuración";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
