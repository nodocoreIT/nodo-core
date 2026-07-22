"use client";

import { MedicoHomePanel } from "@/components/dashboard/medico-home-panel";
import { useMedicoDoctor } from "@/contexts/medico-doctor-context";

export default function MedicoDashboardPage() {
  const doctor = useMedicoDoctor();

  return (
    <MedicoHomePanel doctorId={doctor.id} doctorName={doctor.fullName} />
  );
}
