"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { clinicApi } from "@/lib/clinic/client-api";
import {
  DEFAULT_AVAILABILITY,
  getNextAttendanceDateKey,
  getScheduleBlocksForDate,
  localDateKeyFromDate,
  localDateKeyFromIso,
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
  const [nextDayAppts, setNextDayAppts] = useState<AppointmentRow[]>([]);
  const [nextDayKey, setNextDayKey] = useState<string | null>(null);
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
        clinicApi.getDoctorQueue(doctorId),
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

      const nextKey = getNextAttendanceDateKey(avail);
      setNextDayKey(nextKey);

      const rows = (upcoming as AppointmentRow[]).filter(
        (a) => a.status !== "cancelled",
      );

      setTodayAppts(
        rows.filter((a) => localDateKeyFromIso(a.scheduledAt) === todayKey),
      );
      setNextDayAppts(
        nextKey
          ? rows.filter((a) => localDateKeyFromIso(a.scheduledAt) === nextKey)
          : [],
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

  const todayBlocks = getScheduleBlocksForDate(availability, new Date());
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
    const items: TodayTask[] = [];

    for (const block of todayBlocks) {
      items.push({
        id: `block-${block.startTime}`,
        label: `Franja de atención ${block.startTime} — ${block.endTime}`,
        done: false,
      });
    }

    for (const apt of todayAppts) {
      const lifecycle = mapAppointmentStatusToLifecycle(
        apt.status as "scheduled",
      );
      items.push({
        id: apt.id,
        label: `Consulta — ${apt.patient?.fullName ?? "Paciente"}`,
        time: format(new Date(apt.scheduledAt), "HH:mm"),
        done: lifecycle === "finalizada",
      });
    }

    for (const task of manualTasks) {
      items.push({
        id: task.id,
        label: task.title,
        done: task.done,
      });
    }

    return items;
  }, [todayAppts, todayBlocks, manualTasks]);

  return {
    loading,
    todayAppts,
    nextDayAppts,
    nextDayKey,
    todayBlocks,
    calendarSrc,
    stats,
    todayTasks,
  };
}
