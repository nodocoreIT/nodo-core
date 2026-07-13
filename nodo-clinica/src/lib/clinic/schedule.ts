import {
  addDays,
  addMinutes,
  format,
  isAfter,
  setHours,
  setMinutes,
  startOfDay,
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

function parseTimeOnDate(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  return setMinutes(setHours(startOfDay(date), h), m);
}

export function generateSlotsForDate(
  date: Date,
  availability: DoctorAvailability,
  bookedTimes: string[]
): { iso: string; label: string }[] {
  const normalized = normalizeAvailability(availability);
  const dow = date.getDay();
  const dayBlocks = normalized.days.filter((d) => d.dayOfWeek === dow);
  if (dayBlocks.length === 0) return [];

  const slots: { iso: string; label: string }[] = [];
  const seen = new Set<string>();
  const bookedSet = new Set(
    bookedTimes.map((t) => new Date(t).toISOString().slice(0, 16))
  );

  for (const block of dayBlocks) {
    let cursor = parseTimeOnDate(date, block.startTime);
    const end = parseTimeOnDate(date, block.endTime);

    while (cursor < end) {
      const slotEnd = addMinutes(cursor, normalized.slotDurationMinutes);
      if (slotEnd > end) break;

      const iso = cursor.toISOString();
      const key = iso.slice(0, 16);
      if (!seen.has(iso) && !bookedSet.has(key) && isAfter(cursor, new Date())) {
        seen.add(iso);
        slots.push({
          iso,
          label: format(cursor, "HH:mm", { locale: es }),
        });
      }
      cursor = addMinutes(cursor, normalized.slotDurationMinutes);
    }
  }

  return slots;
}

export function localDateKeyFromIso(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd");
}

export function localDateKeyFromDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Next N working days from today (includes today if it is a working day). */
export function getUpcomingWorkingDateKeys(
  availability: DoctorAvailability,
  count = 3
): string[] {
  const normalized = normalizeAvailability(availability);
  const blocked = new Set(availability.blockedDates ?? []);
  const keys: string[] = [];
  const today = startOfDay(new Date());

  for (let i = 0; i < 90 && keys.length < count; i++) {
    const d = addDays(today, i);
    const dateStr = format(d, "yyyy-MM-dd");
    const dow = d.getDay();
    if (!normalized.days.some((day) => day.dayOfWeek === dow)) continue;
    if (blocked.has(dateStr)) continue;
    keys.push(dateStr);
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
  date: Date,
): DaySchedule[] {
  const dow = date.getDay();
  return normalizeAvailability(availability).days.filter(
    (d) => d.dayOfWeek === dow,
  );
}

export function formatDateKeyLabel(dateKey: string): string {
  const d = parseLocalDate(dateKey);
  return format(d, "EEEE d 'de' MMMM", { locale: es });
}

export function getAvailableDates(
  availability: DoctorAvailability,
  daysAhead = 28,
  bookedTimes: string[] = []
): Date[] {
  const normalized = normalizeAvailability(availability);
  const blocked = new Set(availability.blockedDates ?? []);
  const dates: Date[] = [];
  const today = startOfDay(new Date());

  for (let i = 0; i < daysAhead; i++) {
    const d = addDays(today, i);
    const dateStr = format(d, "yyyy-MM-dd");
    const dow = d.getDay();
    if (!normalized.days.some((day) => day.dayOfWeek === dow)) continue;
    if (blocked.has(dateStr)) continue;

    const dayBooked = bookedTimes.filter(
      (t) => localDateKeyFromIso(t) === dateStr
    );
    const slots = generateSlotsForDate(d, normalized, dayBooked);
    if (slots.length === 0) continue;

    dates.push(d);
  }
  return dates;
}
