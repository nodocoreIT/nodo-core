"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import { clinicApi } from "@/lib/clinic/client-api";
import { DoctorAssignAppointmentForm } from "@/components/dashboard/doctor-assign-appointment-form";

export function AssignAppointmentsPage() {
  const router = useRouter();
  const [doctorId, setDoctorId] = useState<string | null>(null);

  useEffect(() => {
    clinicApi.getSession().then(({ session, user }) => {
      if (!session || !["doctor", "admin", "super_admin"].includes(session.role)) {
        router.push("/login/medico");
        return;
      }
      setDoctorId(user.id);
    });
  }, [router]);

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
        <h2 className="text-lg font-semibold text-navy flex items-center gap-2">
          <CalendarPlus className="h-5 w-5 text-brand" />
          Asignar Turnos
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Buscá un paciente, elegí los horarios disponibles y enviá la confirmación por email
          para que complete el pago.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <DoctorAssignAppointmentForm doctorId={doctorId} active />
      </div>
    </div>
  );
}
