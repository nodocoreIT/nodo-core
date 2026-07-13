import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/clinic/local-db";
import type { DoctorPaymentSettings, DoctorReminderSettings } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { mergeThemeSettings } from "@/lib/clinic/theme-settings";
import {
  DEFAULT_AVAILABILITY,
  generateSlotsForDate,
  getAvailableDates,
  normalizeAvailability,
  parseLocalDate,
  localDateKeyFromIso,
  type DoctorAvailability,
} from "@/lib/clinic/schedule";

function getAvailability(doctor: { availability?: DoctorAvailability }) {
  const base = doctor.availability ?? DEFAULT_AVAILABILITY;
  return normalizeAvailability({
    ...base,
    blockedDates: base.blockedDates ?? [],
  });
}

function ownPaymentForDoctor(payment?: DoctorPaymentSettings) {
  if (!payment) return {};
  const { mercadopagoAccessToken, ...rest } = payment;
  const token = mercadopagoAccessToken?.trim();
  return {
    ...rest,
    mercadopagoAccessToken: token ? `····${token.slice(-4)}` : "",
    hasMercadopagoToken: !!token,
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
    const dates = getAvailableDates(availability, 28, allBooked).map((d) => ({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("es-AR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    }));
    return NextResponse.json({
      dates,
      slotDurationMinutes: availability.slotDurationMinutes,
      blockedDates: availability.blockedDates ?? [],
    });
  }

  if ((availability.blockedDates ?? []).includes(dateStr)) {
    return NextResponse.json({ slots: [], slotDurationMinutes: availability.slotDurationMinutes });
  }

  const date = parseLocalDate(dateStr);
  const booked = allBooked.filter(
    (t) => localDateKeyFromIso(t) === dateStr
  );
  const slots = generateSlotsForDate(date, availability, booked);
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
  };

  await writeDb((db) => {
    const doctor = db.doctors.find((d) => d.id === session.userId);
    if (!doctor) return;
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
      const existing = doctor.payment?.mercadopagoAccessToken;
      const incoming = payment.mercadopagoAccessToken?.trim();
      const keepExisting =
        !incoming ||
        incoming.startsWith("····") ||
        incoming.includes("····");
      doctor.payment = {
        ...payment,
        mercadopagoAccessToken: keepExisting ? existing : incoming,
      };
    }
    if (reminderSettings !== undefined) doctor.reminderSettings = reminderSettings;
    if (googleCalendarId !== undefined) doctor.googleCalendarId = googleCalendarId;
    if (themeSettings !== undefined) {
      doctor.themeSettings = mergeThemeSettings(themeSettings);
    }
  });

  return NextResponse.json({ ok: true });
}
