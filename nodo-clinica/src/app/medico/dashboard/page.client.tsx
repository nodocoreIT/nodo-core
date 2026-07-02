"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MedicoHomePanel } from "@/components/dashboard/medico-home-panel";
import { clinicApi } from "@/lib/clinic/client-api";
import { Loader2 } from "lucide-react";

export function MedicoDashboardClient() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<{ id: string; fullName: string } | null>(null);

  useEffect(() => {
    clinicApi.getSession().then(({ session, user }) => {
      if (!session || session.role !== "doctor") {
        router.push("/login");
        return;
      }
      setDoctor({ id: user.id, fullName: user.fullName });
    });
  }, [router]);

  if (!doctor) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return <MedicoHomePanel doctorId={doctor.id} doctorName={doctor.fullName} />;
}
