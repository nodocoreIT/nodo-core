import {
  addDays,
  format,
  isAfter,
} from "date-fns";
import { es } from "date-fns/locale";

export interface DaySchedule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface DoctorAvailability {
  slotDurationMinutes: number;
  days: DaySchedule[];
  blockedDates?: string[];
}

export const DEFAULT_AVAILABILITY: DoctorAvailability = {
  slotDurationMinutes: 30,
  days: [
    { dayOfWeek: 1, startTime: "09:00", endTime: "13:00" },
    { dayOfWeek: 1, startTime: "16:00", endTime: "19:00" },
    { dayOfWeek: 2, startTime: "09:00", endTime: "13:00" },
    { dayOfWeek: 3, startTime: "09:00", endTime: "13:00" },
    { dayOfWeek: 4, startTime: "09:00", endTime: "13:00" },
    { dayOfWeek: 5, startTime: "09:00", endTime: "12:00" },
  ],
};

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function dayLabel(dayOfWeek: number) {
  return DAY_LABELS[dayOfWeek] ?? "?";
}

/** Parse YYYY-MM-DD as local calendar date (avoids UTC shift). */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Merge overlapping blocks; keep separate morning/afternoon shifts. */
function mergeDayBlocks(blocks: DaySchedule[]): DaySchedule[] {
  if (blocks.length <= 1) return blocks;

  const sorted = [...blocks].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );
  const merged: DaySchedule[] = [];

  for (const block of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...block });
      continue;
    }
    if (block.startTime <= last.endTime) {
      if (block.endTime > last.endTime) last.endTime = block.endTime;
      continue;
    }
    merged.push({ ...block });
  }

  return merged;
}

export function normalizeAvailability(
  availability: DoctorAvailability
): DoctorAvailability {
  const byDay = new Map<number, DaySchedule[]>();

  for (const block of availability.days) {
    const list = byDay.get(block.dayOfWeek) ?? [];
    list.push(block);
    byDay.set(block.dayOfWeek, list);
  }

  const days: DaySchedule[] = [];
  for (const [dayOfWeek, blocks] of byDay) {
    for (const block of mergeDayBlocks(blocks)) {
      days.push({ ...block, dayOfWeek });
    }
  }

  days.sort((a, b) => {
    const order = (d: number) => (d === 0 ? 7 : d);
    return order(a.dayOfWeek) - order(b.dayOfWeek);
  });

  return {
    slotDurationMinutes: availability.slotDurationMinutes,
    days,
    blockedDates: availability.blockedDates,
  };
}

export function generateSlotsForDate(
  dateKey: string,
  availability: DoctorAvailability,
  bookedTimes: string[],
): { iso: string; label: string }[] {
  const normalized = normalizeAvailability(availability);
  const dow = clinicDayOfWeek(dateKey);
  const dayBlocks = normalized.days.filter((d) => d.dayOfWeek === dow);
  if (dayBlocks.length === 0) return [];

  const slots: { iso: string; label: string }[] = [];
  const seen = new Set<string>();
  const bookedSet = new Set(bookedTimes.map((t) => t.slice(0, 16)));
  const duration = normalized.slotDurationMinutes;
  const now = new Date();

  for (const block of dayBlocks) {
    let cursorMin = timeToMinutes(block.startTime);
    const endMin = timeToMinutes(block.endTime);

    while (cursorMin + duration <= endMin) {
      const hh = Math.floor(cursorMin / 60);
      const mm = cursorMin % 60;
      const time = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      const iso = argentinaDateTimeToIso(dateKey, time);

      if (
        !seen.has(iso) &&
        !bookedSet.has(iso.slice(0, 16)) &&
        isAfter(new Date(iso), now)
      ) {
        seen.add(iso);
        slots.push({ iso, label: formatClinicTimeLabel(iso) });
      }
      cursorMin += duration;
    }
  }

  return slots;
}

export const CLINIC_TIMEZONE = "America/Argentina/Buenos_Aires";

export function localDateKeyFromIso(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function localDateKeyFromDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function argentinaDateTimeToIso(dateKey: string, time: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h + 3, min)).toISOString();
}

function clinicDayOfWeek(dateKey: string): number {
  const ref = new Date(argentinaDateTimeToIso(dateKey, "12:00"));
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIMEZONE,
    weekday: "short",
  }).format(ref);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? 0;
}

function formatClinicTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: CLINIC_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function clinicTimeLabelFromIso(iso: string): string {
  return formatClinicTimeLabel(iso);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const base = new Date(argentinaDateTimeToIso(dateKey, "12:00"));
  return localDateKeyFromDate(addDays(base, days));
}

function clinicMinutesFromIso(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/** Next N working days from today (includes today if it is a working day). */
export function getUpcomingWorkingDateKeys(
  availability: DoctorAvailability,
  count = 3
): string[] {
  const normalized = normalizeAvailability(availability);
  const blocked = new Set(availability.blockedDates ?? []);
  const keys: string[] = [];
  const todayKey = localDateKeyFromDate(new Date());

  for (let i = 0; i < 90 && keys.length < count; i++) {
    const dateKey = addDaysToDateKey(todayKey, i);
    const dow = clinicDayOfWeek(dateKey);
    if (!normalized.days.some((day) => day.dayOfWeek === dow)) continue;
    if (blocked.has(dateKey)) continue;
    keys.push(dateKey);
  }
  return keys;
}

/** Próximo día laborable con atención, estrictamente después de hoy. */
export function getNextAttendanceDateKey(
  availability: DoctorAvailability,
): string | null {
  const today = localDateKeyFromDate(new Date());
  const keys = getUpcomingWorkingDateKeys(availability, 30);
  return keys.find((k) => k > today) ?? null;
}

export function getScheduleBlocksForDate(
  availability: DoctorAvailability,
  dateKey: string,
): DaySchedule[] {
  const dow = clinicDayOfWeek(dateKey);
  return normalizeAvailability(availability).days.filter(
    (d) => d.dayOfWeek === dow,
  );
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** True if the appointment starts on the doctor's grid for that day. */
export function appointmentMatchesScheduleGrid(
  scheduledAtIso: string,
  availability: DoctorAvailability,
): boolean {
  const normalized = normalizeAvailability(availability);
  const dateKey = localDateKeyFromIso(scheduledAtIso);
  if ((normalized.blockedDates ?? []).includes(dateKey)) return false;

  const blocks = getScheduleBlocksForDate(normalized, dateKey);
  if (blocks.length === 0) return false;

  const aptMinutes = clinicMinutesFromIso(scheduledAtIso);
  const duration = normalized.slotDurationMinutes;

  return blocks.some((block) => {
    const startMin = timeToMinutes(block.startTime);
    const endMin = timeToMinutes(block.endTime);
    if (aptMinutes < startMin || aptMinutes >= endMin) return false;
    return (aptMinutes - startMin) % duration === 0;
  });
}

export function slotKeyFromIso(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}

export function formatDateKeyLabel(dateKey: string): string {
  const d = parseLocalDate(dateKey);
  return format(d, "EEEE d 'de' MMMM", { locale: es });
}

export function formatDateKeyShortLabel(dateKey: string): string {
  const d = parseLocalDate(dateKey);
  return format(d, "EEE, d MMM", { locale: es });
}

export function getAvailableDateKeys(
  availability: DoctorAvailability,
  daysAhead = 28,
  bookedTimes: string[] = [],
): string[] {
  const normalized = normalizeAvailability(availability);
  const blocked = new Set(availability.blockedDates ?? []);
  const keys: string[] = [];
  const todayKey = localDateKeyFromDate(new Date());

  for (let i = 0; i < daysAhead; i++) {
    const dateKey = addDaysToDateKey(todayKey, i);
    const dow = clinicDayOfWeek(dateKey);
    if (!normalized.days.some((day) => day.dayOfWeek === dow)) continue;
    if (blocked.has(dateKey)) continue;

    const dayBooked = bookedTimes.filter(
      (t) => localDateKeyFromIso(t) === dateKey,
    );
    const slots = generateSlotsForDate(dateKey, normalized, dayBooked);
    if (slots.length === 0) continue;

    keys.push(dateKey);
  }
  return keys;
}

export function getAvailableDates(
  availability: DoctorAvailability,
  daysAhead = 28,
  bookedTimes: string[] = [],
): Date[] {
  return getAvailableDateKeys(availability, daysAhead, bookedTimes).map(
    parseLocalDate,
  );
}
