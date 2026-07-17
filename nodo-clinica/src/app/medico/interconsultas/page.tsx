"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { NodoChatWidget } from "@/components/nodo-chat/nodo-chat-widget";
import { clinicApi } from "@/lib/clinic/client-api";
import { isProPlan } from "@/lib/nodo-chat/is-pro-plan";

export default function MedicoInterconsultasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      }
    >
      <MedicoInterconsultasContent />
    </Suspense>
  );
}

function MedicoInterconsultasContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [doctor, setDoctor] = useState<{
    id: string;
    fullName: string;
    subscriptionPlan?: string;
  } | null>(null);

  useEffect(() => {
    clinicApi.getSession().then(({ session, user }) => {
      if (!session || !["doctor", "admin", "super_admin"].includes(session.role)) {
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
      initialPeerId={searchParams.get("peerId")}
      initialPeerName={searchParams.get("peerName")}
    />
  );
}
