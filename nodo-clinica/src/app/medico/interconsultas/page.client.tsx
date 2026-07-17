"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PlanGate } from "@nodocore/shared-components";
import { NodoChatWidget } from "@/components/nodo-chat/nodo-chat-widget";
import { clinicApi } from "@/lib/clinic/client-api";
import { isProPlan } from "@/lib/nodo-chat/is-pro-plan";
import { isPlatformMode } from "@/lib/clinic/platform-config";

export function MedicoInterconsultasClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const pro = isProPlan(doctor.subscriptionPlan);

  const chat = (
    <NodoChatWidget
      doctorId={doctor.id}
      doctorName={doctor.fullName}
      isPro={pro}
      embedded
      initialPeerId={searchParams.get("peerId")}
      initialPeerName={searchParams.get("peerName")}
    />
  );

  if (isPlatformMode()) {
    return <PlanGate requiredPlan="pro" fullPage>{chat}</PlanGate>;
  }

  if (!pro) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm font-semibold text-slate-700">
          Interconsultas disponible en Plan Pro
        </p>
        <p className="text-xs text-slate-500">
          Contactá a NodoCore para actualizar tu plan.
        </p>
      </div>
    );
  }

  return chat;
}
