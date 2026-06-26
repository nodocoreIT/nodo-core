"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { clinicApi } from "@/lib/clinic/client-api";
import {
  DEFAULT_AVAILABILITY,
  getScheduleBlocksForDate,
  localDateKeyFromDate,
  localDateKeyFromIso,
  appointmentMatchesScheduleGrid,
  type DoctorAvailability,
} from "@/lib/clinic/schedule";
import { mapAppointmentStatusToLifecycle } from "@/types";
import { parseGoogleCalendarSrc } from "@/lib/google-calendar";

export interface AppointmentRow {
  id: string;
  scheduledAt: string;
  status: string;
  patient?: {
    fullName: string;
    email?: string;
    profilePhotoData?: string;
  };
  documentCount?: number;
  intakeReason?: string;
}

export interface TodayTask {
  id: string;
  label: string;
  time?: string;
  done: boolean;
}

export function useMedicoHomeAgenda(doctorId: string) {
  const [loading, setLoading] = useState(true);
  const [todayAppts, setTodayAppts] = useState<AppointmentRow[]>([]);
  const [upcomingAppts, setUpcomingAppts] = useState<AppointmentRow[]>([]);
  const [availability, setAvailability] =
    useState<DoctorAvailability>(DEFAULT_AVAILABILITY);
  const [googleCalendarId, setGoogleCalendarId] = useState("");
  const [manualTasks, setManualTasks] = useState<
    Array<{ id: string; title: string; done: boolean }>
  >([]);

  const todayKey = localDateKeyFromDate(new Date());

  const load = useCallback(async () => {
    try {
      const [schedule, upcoming, tasksRes] = await Promise.all([
        clinicApi.getDoctorSchedule(doctorId),
        clinicApi.getDoctorAppointments(doctorId, "upcoming"),
        clinicApi.getDoctorTasks(todayKey).catch(() => ({ tasks: [] })),
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

      const rows = (upcoming as AppointmentRow[])
        .filter(
          (a) =>
            a.status !== "cancelled" &&
            appointmentMatchesScheduleGrid(a.scheduledAt, avail),
        )
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime(),
        );

      setTodayAppts(
        rows.filter((a) => localDateKeyFromIso(a.scheduledAt) === todayKey),
      );
      setUpcomingAppts(
        rows.filter((a) => localDateKeyFromIso(a.scheduledAt) > todayKey),
      );
    } finally {
      setLoading(false);
    }
  }, [doctorId, todayKey]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const todayBlocks = getScheduleBlocksForDate(availability, todayKey);
  const calendarSrc = googleCalendarId
    ? parseGoogleCalendarSrc(googleCalendarId)
    : null;

  const stats = useMemo(() => {
    const waiting = todayAppts.filter(
      (a) =>
        mapAppointmentStatusToLifecycle(a.status as "scheduled") === "en_espera",
    ).length;
    const inConsult = todayAppts.filter(
      (a) =>
        mapAppointmentStatusToLifecycle(a.status as "scheduled") === "en_consulta",
    ).length;
    const done = todayAppts.filter(
      (a) =>
        mapAppointmentStatusToLifecycle(a.status as "scheduled") === "finalizada",
    ).length;
    return { waiting, inConsult, done };
  }, [todayAppts]);

  const todayTasks = useMemo((): TodayTask[] => {
    type SortableTask = TodayTask & { sortKey: string };

    const items: SortableTask[] = [];

    for (const block of todayBlocks) {
      items.push({
        id: `block-${block.startTime}`,
        label: `Franja de atención ${block.startTime} — ${block.endTime}`,
        done: false,
        sortKey: `0-${block.startTime}`,
      });
    }

    const sortedToday = [...todayAppts].sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );

    for (const apt of sortedToday) {
      const lifecycle = mapAppointmentStatusToLifecycle(
        apt.status as "scheduled",
      );
      const time = format(new Date(apt.scheduledAt), "HH:mm");
      items.push({
        id: apt.id,
        label: `Consulta hoy — ${apt.patient?.fullName ?? "Paciente"}`,
        time,
        done: lifecycle === "finalizada",
        sortKey: `1-${time}`,
      });
    }

    for (const apt of upcomingAppts) {
      const lifecycle = mapAppointmentStatusToLifecycle(
        apt.status as "scheduled",
      );
      const when = new Date(apt.scheduledAt);
      const dateLabel = format(when, "EEE d MMM", { locale: es });
      const time = format(when, "HH:mm");
      items.push({
        id: `up-${apt.id}`,
        label: `Turno ${dateLabel} — ${apt.patient?.fullName ?? "Paciente"}`,
        time,
        done: lifecycle === "finalizada",
        sortKey: `2-${apt.scheduledAt}`,
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
  }, [todayAppts, upcomingAppts, todayBlocks, manualTasks]);

  return {
    loading,
    todayAppts,
    upcomingAppts,
    todayBlocks,
    calendarSrc,
    stats,
    todayTasks,
  };
}
