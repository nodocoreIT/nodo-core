"use client";

import { useEffect, useState } from "react";
import { clinicApi, getClientSession } from "@/lib/clinic/client-api";
import { PatientHistorySection } from "@/components/patient/patient-history-section";
import { PatientPlanUpsellCard } from "@/components/patient/patient-plan-upsell-card";
import type { PatientTimelineItem } from "@/lib/clinic/patient-timeline";
import { Loader2 } from "lucide-react";

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
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!patientId) return null;

  if (locked) {
    return (
      <PatientPlanUpsellCard
        title="Desbloqueá tu Historial"
        description="Con el plan Pago accedés al historial completo de consultas, tu historia clínica y los archivos que vayas subiendo."
      />
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
