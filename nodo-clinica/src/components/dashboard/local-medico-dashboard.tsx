"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DoctorDashboard } from "@/components/dashboard/doctor-dashboard";
import { clinicApi } from "@/lib/clinic/client-api";
import { Loader2 } from "lucide-react";

export function LocalMedicoDashboard() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<{
    id: string;
    fullName: string;
    specialty?: string;
    licenseNumber?: string;
  } | null>(null);

  useEffect(() => {
    clinicApi.getSession().then(({ session, user }) => {
      if (!session || session.role !== "doctor") {
        router.push("/login/medico");
        return;
      }
      setDoctor({
        id: user.id,
        fullName: user.fullName,
        specialty: user.specialty,
        licenseNumber: user.licenseNumber,
      });
    });
  }, [router]);

  if (!doctor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <DoctorDashboard
      doctorId={doctor.id}
      doctorName={doctor.fullName}
      doctorSpecialty={doctor.specialty}
      doctorLicense={doctor.licenseNumber}
      dataSource="local"
    />
  );
}
