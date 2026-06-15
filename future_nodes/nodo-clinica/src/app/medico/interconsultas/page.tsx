"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { InterconsultPanel } from "@/components/interconsult/interconsult-panel";
import { clinicApi } from "@/lib/clinic/client-api";

export default function MedicoInterconsultasPage() {
  const router = useRouter();
  const [doctorId, setDoctorId] = useState<string | null>(null);

  useEffect(() => {
    clinicApi.getSession().then(({ session, user }) => {
      if (!session || session.role !== "doctor") {
        router.push("/login");
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

  return <InterconsultPanel currentDoctorId={doctorId} />;
}
