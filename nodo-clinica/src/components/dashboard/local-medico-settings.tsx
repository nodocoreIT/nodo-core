"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DoctorOfficePanel } from "@/components/medical/doctor-office-panel";
import { clinicApi } from "@/lib/clinic/client-api";

const VALID_TABS = new Set([
  "agenda",
  "perfil",
  "cobros",
  "avisos",
  "libres",
  "apariencia",
]);

export function LocalMedicoSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const defaultTab =
    tabParam && VALID_TABS.has(tabParam) ? tabParam : undefined;
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
    <DoctorOfficePanel
      doctorId={doctorId}
      fullPage
      defaultTab={defaultTab}
    />
  );
}
