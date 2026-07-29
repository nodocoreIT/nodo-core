"use client";

import { useEffect, useState } from "react";
import { clinicApi, getClientSession } from "@/lib/clinic/client-api";
import { PatientHistorySection } from "@/components/patient/patient-history-section";
import type { PatientTimelineItem } from "@/lib/clinic/patient-timeline";
import { Loader2, Lock } from "lucide-react";

export default function PacienteHistorialPage() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<PatientTimelineItem[]>([]);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        let resolvedId: string | null = null;
        try {
          const { user } = await clinicApi.getSession();
          if (user?.id) resolvedId = user.id;
        } catch {
          /* fallback */
        }
        if (!resolvedId) {
          const stored = getClientSession();
          if (stored?.role === "patient") resolvedId = stored.userId;
        }
        if (!resolvedId) return;

        setPatientId(resolvedId);
        const data = await clinicApi.getPatientHistory(resolvedId);
        setLocked(Boolean(data.locked));
        setTimeline(data.timeline ?? []);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (!patientId && loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!patientId) return null;

  if (locked) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Lock className="h-5 w-5 text-slate-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            Tu historial está disponible en el plan Pago
          </p>
          <p className="max-w-sm text-xs text-slate-400">
            Con el plan Pago accedés al historial completo de consultas, tu historia clínica y los archivos que vayas subiendo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PatientHistorySection
        patientId={patientId}
        timeline={timeline}
        loading={loading}
      />
    </div>
  );
}
