"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DoctorDashboard } from "@/components/dashboard/doctor-dashboard";
import { clinicApi } from "@/lib/clinic/client-api";
import { Loader2 } from "lucide-react";

export function LocalMedicoDashboard({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [doctor, setDoctor] = useState<{
    id: string;
    fullName: string;
    specialty?: string;
    licenseNumber?: string;
  } | null>(null);

  useEffect(() => {
    clinicApi.getSession().then(({ session, user }) => {
      if (!session || !["doctor", "admin", "super_admin"].includes(session.role)) {
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
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
      embedded={embedded}
    />
  );
}
