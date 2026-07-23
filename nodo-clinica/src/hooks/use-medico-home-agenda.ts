"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { clinicApi } from "@/lib/clinic/client-api";
import {
  DEFAULT_AVAILABILITY,
  addDaysToDateKey,
  getScheduleBlocksForDate,
  localDateKeyFromDate,
  localDateKeyFromIso,
  parseLocalDate,
  type DoctorAvailability,
} from "@/lib/clinic/schedule";
import {
  normalizeAppointmentRows,
  type NormalizedAppointmentRow,
} from "@/lib/clinic/normalize-appointment-row";
import { mapAppointmentStatusToLifecycle } from "@/types";
import { parseGoogleCalendarSrc } from "@/lib/google-calendar";

export type AppointmentRow = NormalizedAppointmentRow;

export interface TodayTask {
  id: string;
  label: string;
  time?: string;
  done: boolean;
  status?: "en_espera" | "en_consulta" | "finalizada";
}

export function useMedicoHomeAgenda(doctorId: string) {
  const [loading, setLoading] = useState(true);
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    localDateKeyFromDate(new Date()),
  );
  const [dayAppts, setDayAppts] = useState<AppointmentRow[]>([]);
  const [upcomingAppts, setUpcomingAppts] = useState<AppointmentRow[]>([]);
  const [availability, setAvailability] =
    useState<DoctorAvailability>(DEFAULT_AVAILABILITY);
  const [googleCalendarId, setGoogleCalendarId] = useState("");
  const [manualTasks, setManualTasks] = useState<
    Array<{ id: string; title: string; done: boolean }>
  >([]);

  const todayKey = localDateKeyFromDate(new Date());
  const tomorrowKey = addDaysToDateKey(todayKey, 1);

  const load = useCallback(async () => {
    try {
      const [schedule, dayRes, upcomingRes, tasksRes] = await Promise.all([
        clinicApi.getDoctorSchedule(doctorId),
        clinicApi.getDoctorAppointmentsDay(doctorId, selectedDateKey),
        clinicApi.getDoctorAppointments(doctorId, "upcoming"),
        clinicApi
          .getDoctorTasks(selectedDateKey)
          .catch(() => ({ tasks: [] })),
      ]);

      const avail: DoctorAvailability =
        schedule.availability ?? DEFAULT_AVAILABILITY;
      setAvailability(avail);
      setGoogleCalendarId(schedule.googleCalendarId ?? "");

      setManualTasks(
        tasksRes.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          done: t.done,
        })),
      );

      const dayRows = normalizeAppointmentRows(dayRes.appointments ?? []);
      setDayAppts(dayRows);

      const upcomingRows = normalizeAppointmentRows(
        Array.isArray(upcomingRes) ? upcomingRes : [],
      )
        .filter((a) => localDateKeyFromIso(a.scheduledAt) > selectedDateKey)
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime(),
        );
      setUpcomingAppts(upcomingRows);
    } catch {
      setDayAppts([]);
      setUpcomingAppts([]);
    } finally {
      setLoading(false);
    }
  }, [doctorId, selectedDateKey]);

  useEffect(() => {
    setLoading(true);
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const selectedBlocks = getScheduleBlocksForDate(availability, selectedDateKey);
  const calendarSrc = googleCalendarId
    ? parseGoogleCalendarSrc(googleCalendarId)
    : null;

  const stats = useMemo(() => {
    const waiting = dayAppts.filter(
      (a) =>
        mapAppointmentStatusToLifecycle(a.status as "scheduled") ===
        "en_espera",
    ).length;
    const inConsult = dayAppts.filter(
      (a) =>
        mapAppointmentStatusToLifecycle(a.status as "scheduled") ===
        "en_consulta",
    ).length;
    const done = dayAppts.filter(
      (a) =>
        mapAppointmentStatusToLifecycle(a.status as "scheduled") ===
        "finalizada",
    ).length;
    return { waiting, inConsult, done };
  }, [dayAppts]);

  const dayTasks = useMemo((): TodayTask[] => {
    type SortableTask = TodayTask & { sortKey: string };

    const items: SortableTask[] = [];
    const isToday = selectedDateKey === todayKey;
    const dayLabel = isToday
      ? "hoy"
      : selectedDateKey === tomorrowKey
        ? "mañana"
        : format(parseLocalDate(selectedDateKey), "EEE d MMM", { locale: es });

    for (const block of selectedBlocks) {
      items.push({
        id: `block-${block.startTime}`,
        label: `Franja de atención ${block.startTime} — ${block.endTime}`,
        done: false,
        sortKey: `0-${block.startTime}`,
      });
    }

    const sortedDay = [...dayAppts].sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );

    for (const apt of sortedDay) {
      const lifecycle = mapAppointmentStatusToLifecycle(
        apt.status as "scheduled",
      );
      const time = format(new Date(apt.scheduledAt), "HH:mm");
      items.push({
        id: apt.id,
        label: `Consulta ${dayLabel} — ${apt.patient?.fullName ?? "Paciente"}`,
        time,
        done: lifecycle === "finalizada",
        status: lifecycle,
        sortKey: `1-${time}`,
      });
    }

    for (const task of manualTasks) {
      items.push({
        id: task.id,
        label: task.title,
        done: task.done,
        sortKey: "9-manual",
      });
    }

    items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    return items.map(({ sortKey: _sortKey, ...task }) => task);
  }, [
    dayAppts,
    manualTasks,
    selectedBlocks,
    selectedDateKey,
    todayKey,
    tomorrowKey,
  ]);

  const selectedDateLabel = useMemo(() => {
    if (selectedDateKey === todayKey) return "Hoy";
    if (selectedDateKey === tomorrowKey) return "Mañana";
    return format(parseLocalDate(selectedDateKey), "EEEE d MMM", {
      locale: es,
    });
  }, [selectedDateKey, todayKey, tomorrowKey]);

  const selectToday = useCallback(() => setSelectedDateKey(todayKey), [todayKey]);
  const selectTomorrow = useCallback(
    () => setSelectedDateKey(tomorrowKey),
    [tomorrowKey],
  );

  return {
    loading,
    selectedDateKey,
    setSelectedDateKey,
    selectToday,
    selectTomorrow,
    selectedDateLabel,
    todayKey,
    tomorrowKey,
    dayAppts,
    upcomingAppts,
    selectedBlocks,
    calendarSrc,
    stats,
    dayTasks,
    /** @deprecated use dayAppts */
    todayAppts: dayAppts,
    /** @deprecated use selectedBlocks */
    todayBlocks: selectedBlocks,
    /** @deprecated use dayTasks */
    todayTasks: dayTasks,
  };
}
