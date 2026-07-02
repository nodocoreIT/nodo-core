"use client";

import { useEffect, useState } from "react";
import { clinicApi } from "@/lib/clinic/client-api";
import { PatientHealthProfileSection } from "@/components/patient/patient-health-profile-section";
import type { PatientHealthProfile } from "@/lib/clinic/local-db";
import { Loader2 } from "lucide-react";

// Used in local mode — fetches its own session
export function PacienteSaludClient() {
  const [profile, setProfile] = useState<PatientHealthProfile | null | undefined>(undefined);

  useEffect(() => {
    clinicApi.getSession().then(({ user }) => {
      setProfile(user?.healthProfile ?? null);
    });
  }, []);

  if (profile === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PatientHealthProfileSection
        initialProfile={profile}
        onSaved={(hp) => setProfile(hp)}
      />
    </div>
  );
}

// Used in supabase mode — receives patientId from server
export function PacienteSaludWrapper({ patientId }: { patientId: string }) {
  const [profile, setProfile] = useState<PatientHealthProfile | null | undefined>(undefined);

  useEffect(() => {
    clinicApi.getSession().then(({ user }) => {
      setProfile(user?.healthProfile ?? null);
    });
  }, [patientId]);

  if (profile === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PatientHealthProfileSection
        initialProfile={profile}
        onSaved={(hp) => setProfile(hp)}
      />
    </div>
  );
}
