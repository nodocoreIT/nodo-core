"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MedicoHomePanel } from "@/components/dashboard/medico-home-panel";
import { clinicApi } from "@/lib/clinic/client-api";
import { Loader2 } from "lucide-react";

export default function MedicoDashboardPage() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<{ id: string; fullName: string } | null>(
    null,
  );

  useEffect(() => {
    clinicApi.getSession().then(({ session, user }) => {
      if (!session || !["doctor", "admin", "super_admin"].includes(session.role)) {
        router.push("/login");
        return;
      }
      setDoctor({ id: user.id, fullName: user.fullName });
    });
  }, [router]);

  useEffect(() => {
    const handler = (e: Event) => {
      const fullName = (e as CustomEvent<{ fullName?: string }>).detail?.fullName;
      if (!fullName) return;
      setDoctor((d) => (d ? { ...d, fullName } : d));
    };
    window.addEventListener("nodo:profile-updated", handler);
    return () => window.removeEventListener("nodo:profile-updated", handler);
  }, []);

  if (!doctor) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <MedicoHomePanel doctorId={doctor.id} doctorName={doctor.fullName} />
  );
}
