"use client";

import { useEffect, useState } from "react";
import { clinicApi, getClientSession } from "@/lib/clinic/client-api";
import { PatientHistorySection } from "@/components/patient/patient-history-section";
import type { PatientTimelineItem } from "@/lib/clinic/patient-timeline";
import { Loader2 } from "lucide-react";

export default function PacienteHistorialPage() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<PatientTimelineItem[]>([]);
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
