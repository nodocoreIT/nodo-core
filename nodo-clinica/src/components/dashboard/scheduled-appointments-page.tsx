"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { clinicApi } from "@/lib/clinic/client-api";
import {
  AppointmentsMonthCalendar,
  type AppointmentCalendarDay,
} from "@/components/dashboard/appointments-month-calendar";
import {
  DayAppointmentsPanel,
  type DayAppointment,
  type PendingRefundItem,
} from "@/components/dashboard/day-appointments-panel";
import { RefundAppointmentModal } from "@/components/dashboard/refund-appointment-modal";

export function ScheduledAppointmentsPage() {
  const router = useRouter();
  const [doctorId, setDoctorId] = useState<string | null>(null);

  const [monthKey, setMonthKey] = useState(() => format(new Date(), "yyyy-MM"));
  const [monthDays, setMonthDays] = useState<AppointmentCalendarDay[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayOpen, setDayOpen] = useState(false);
  const [dayAppointments, setDayAppointments] = useState<DayAppointment[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  const [pendingRefunds, setPendingRefunds] = useState<PendingRefundItem[]>([]);
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  useEffect(() => {
    clinicApi.getSession().then(({ session, user }) => {
      if (!session || !["doctor", "admin", "super_admin"].includes(session.role)) {
        router.push("/login/medico");
        return;
      }
      setDoctorId(user.id);
    });
  }, [router]);

  const loadMonth = useCallback(
    async (id: string, key: string) => {
      setMonthLoading(true);
      try {
        const { days } = await clinicApi.getDoctorAppointmentsMonth(id, key);
        setMonthDays(days);
      } finally {
        setMonthLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!doctorId) return;
    void loadMonth(doctorId, monthKey);
  }, [doctorId, monthKey, loadMonth]);

  const loadDay = useCallback(
    async (id: string, date: string) => {
      setDayLoading(true);
      try {
        const { appointments } = await clinicApi.getDoctorAppointmentsDay(id, date);
        setDayAppointments(appointments as unknown as DayAppointment[]);
      } finally {
        setDayLoading(false);
      }
    },
    [],
  );

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setDayOpen(true);
    if (doctorId) void loadDay(doctorId, date);
  }

  function handleCancelled(pending: PendingRefundItem[]) {
    if (doctorId) {
      void loadMonth(doctorId, monthKey);
      if (selectedDate) void loadDay(doctorId, selectedDate);
    }
    if (pending.length > 0) {
      setPendingRefunds(pending);
      setRefundModalOpen(true);
      setDayOpen(false);
    }
  }

  if (!doctorId) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-navy">Turnos Programados</h2>
        <p className="text-sm text-slate-500">
          Elegí un día para ver los turnos y, si hace falta, cancelarlos.
        </p>
      </div>

      <AppointmentsMonthCalendar
        monthKey={monthKey}
        days={monthDays}
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        onMonthChange={setMonthKey}
        loading={monthLoading}
      />

      <DayAppointmentsPanel
        open={dayOpen}
        onOpenChange={setDayOpen}
        date={selectedDate}
        appointments={dayAppointments}
        loading={dayLoading}
        onCancelled={handleCancelled}
      />

      <RefundAppointmentModal
        open={refundModalOpen}
        items={pendingRefunds}
        onClose={() => {
          setRefundModalOpen(false);
          setPendingRefunds([]);
        }}
      />
    </div>
  );
}
