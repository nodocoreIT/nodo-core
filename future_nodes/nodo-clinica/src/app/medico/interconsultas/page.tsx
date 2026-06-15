"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { NodoChatWidget } from "@/components/nodo-chat/nodo-chat-widget";
import { clinicApi } from "@/lib/clinic/client-api";
import { isProPlan } from "@/lib/nodo-chat/is-pro-plan";

export default function MedicoInterconsultasPage() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<{
    id: string;
    fullName: string;
    subscriptionPlan?: string;
  } | null>(null);

  useEffect(() => {
    clinicApi.getSession().then(({ session, user }) => {
      if (!session || session.role !== "doctor") {
        router.push("/login");
        return;
      }
      setDoctor({
        id: user.id,
        fullName: user.fullName,
        subscriptionPlan: user.subscriptionPlan,
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
    <NodoChatWidget
      doctorId={doctor.id}
      doctorName={doctor.fullName}
      isPro={isProPlan(doctor.subscriptionPlan)}
      embedded
    />
  );
}
