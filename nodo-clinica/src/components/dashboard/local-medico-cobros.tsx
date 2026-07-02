"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Settings, Wallet } from "lucide-react";
import { DoctorCobrosList } from "@/components/medical/doctor-cobros-list";
import { DoctorPaymentsLedger } from "@/components/medical/doctor-payments-ledger";
import { clinicApi } from "@/lib/clinic/client-api";

export function LocalMedicoCobros() {
  const router = useRouter();
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand mb-1">
            <Wallet className="h-5 w-5" />
            <h2 className="font-display text-xl font-bold text-navy">
              Cobros
            </h2>
          </div>
          <p className="text-sm text-slate2 max-w-xl">
            Resumen de pagos recibidos. Los comprobantes de transferencia
            pendientes de revisión aparecen abajo.
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

      <section className="rounded-xl border border-mist bg-white p-4 sm:p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-navy">Cobros recibidos</h3>
        <DoctorCobrosList doctorId={doctorId} />
      </section>

      <section className="rounded-xl border border-mist bg-white p-4 sm:p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-navy">
          Comprobantes pendientes de revisión
        </h3>
        <DoctorPaymentsLedger doctorId={doctorId} pendingOnly />
      </section>
    </div>
  );
}
