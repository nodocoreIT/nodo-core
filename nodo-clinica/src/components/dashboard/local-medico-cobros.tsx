"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Settings, Wallet } from "lucide-react";
import { DoctorCobrosList } from "@/components/medical/doctor-cobros-list";
import { clinicApi } from "@/lib/clinic/client-api";

export function LocalMedicoCobros() {
  const router = useRouter();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRefresh, setPendingRefresh] = useState(0);

  const refreshSidebarBadge = useCallback(() => {
    setPendingRefresh((n) => n + 1);
    window.dispatchEvent(new CustomEvent("cobros-notifications-read"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    clinicApi
      .getSession()
      .then(({ session, user }) => {
        if (cancelled) return;
        const role = session?.role ?? user?.role;
        const id = user?.id ?? session?.userId;
        if (
          !session ||
          !id ||
          !["doctor", "admin", "super_admin", "medico"].includes(role ?? "")
        ) {
          router.push("/login/medico");
          return;
        }
        setDoctorId(id);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "No se pudo cargar la sesión",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!doctorId) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-brand">
            <Wallet className="h-5 w-5" />
            <h2 className="font-display text-xl font-bold text-navy">Cobros</h2>
          </div>
          <p className="max-w-xl text-sm text-slate2">
            Un renglón por paciente: nombre, fecha del comprobante, si coincide
            con el honorario, monto y enlace al archivo. Los pendientes podés
            aprobarlos desde acá.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("nodo:open-settings", {
                detail: { section: "cobros" },
              }),
            )
          }
          className="inline-flex items-center gap-1.5 rounded-md border border-mist bg-white px-3 py-2 text-sm font-medium text-navy transition-colors hover:bg-slate-50"
        >
          <Settings className="h-4 w-4" />
          Configurar honorarios
        </button>
      </div>

      <section className="rounded-xl border border-mist bg-white p-4 shadow-sm sm:p-5">
        <DoctorCobrosList
          key={pendingRefresh}
          doctorId={doctorId}
          onPendingChange={refreshSidebarBadge}
        />
      </section>
    </div>
  );
}
