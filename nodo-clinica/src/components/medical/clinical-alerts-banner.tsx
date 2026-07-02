"use client";

import type { PatientHealthProfile } from "@/lib/clinic/types";
import { AlertTriangle, HeartPulse } from "lucide-react";

interface ClinicalAlertsBannerProps {
  healthProfile?: PatientHealthProfile | null;
  patientName?: string;
  compact?: boolean;
}

export function ClinicalAlertsBanner({
  healthProfile,
  patientName,
  compact = false,
}: ClinicalAlertsBannerProps) {
  if (!healthProfile) return null;

  const allergies = healthProfile.allergies?.trim();
  const chronic = healthProfile.chronicConditions?.trim();
  const medications = healthProfile.medications?.trim();
  const bloodType = healthProfile.bloodType?.trim();

  if (!allergies && !chronic && !medications && !bloodType) return null;

  return (
    <div
      className={`rounded-lg border ${
        allergies
          ? "border-red-200 bg-red-50"
          : "border-amber-200 bg-amber-50"
      } ${compact ? "p-2.5" : "p-3"}`}
      role="alert"
    >
      <div className="flex items-start gap-2">
        {allergies ? (
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
        ) : (
          <HeartPulse className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0 space-y-1">
          <p
            className={`text-xs font-semibold ${
              allergies ? "text-red-800" : "text-amber-900"
            }`}
          >
            {allergies
              ? `Alerta clínica${patientName ? ` — ${patientName}` : ""}`
              : `Datos clínicos relevantes${patientName ? ` — ${patientName}` : ""}`}
          </p>
          {allergies && (
            <p className="text-xs text-red-800">
              <span className="font-medium">Alergias:</span> {allergies}
            </p>
          )}
          {chronic && (
            <p className="text-xs text-slate-700">
              <span className="font-medium">Antecedentes:</span> {chronic}
            </p>
          )}
          {medications && (
            <p className="text-xs text-slate-700">
              <span className="font-medium">Medicación habitual:</span>{" "}
              {medications}
            </p>
          )}
          {bloodType && (
            <p className="text-xs text-slate-600">
              <span className="font-medium">Grupo sanguíneo:</span> {bloodType}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
