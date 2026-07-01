"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Settings, Wallet } from "lucide-react";
import { DoctorCobrosList } from "@/components/medical/doctor-cobros-list";
import { clinicApi } from "@/lib/clinic/client-api";

export function LocalMedicoCobros() {
  const router = useRouter();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [pendingRefresh, setPendingRefresh] = useState(0);

  const refreshSidebarBadge = useCallback(() => {
    setPendingRefresh((n) => n + 1);
    window.dispatchEvent(new CustomEvent("cobros-notifications-read"));
  }, []);

  useEffect(() => {
    clinicApi.getSession().then(({ session, user }) => {
      if (!session || session.role !== "doctor") {
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand mb-1">
            <Wallet className="h-5 w-5" />
            <h2 className="font-display text-xl font-bold text-navy">
              Cobros
            </h2>
          </div>
          <p className="text-sm text-slate2 max-w-xl">
            Un renglón por paciente: nombre, fecha del comprobante, si coincide
            con el honorario, monto y enlace al archivo. Los pendientes podés
            aprobarlos desde acá.
          </p>
        </div>
        <Link
          href="/medico/configuracion?tab=cobros"
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-mist bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-slate-50 transition-colors"
        >
          <Settings className="h-4 w-4" />
          Configurar honorarios
        </Link>
      </div>

      <section className="rounded-xl border border-mist bg-white p-4 sm:p-5 shadow-sm">
        <DoctorCobrosList
          key={pendingRefresh}
          doctorId={doctorId}
          onPendingChange={refreshSidebarBadge}
        />
      </section>
    </div>
  );
}
