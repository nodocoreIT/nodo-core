"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText, Home, VideoOff } from "lucide-react";
import Link from "next/link";

interface ConsultationEndScreenProps {
  role: "doctor" | "patient";
  doctorName?: string;
  onReturn?: () => void;
  onGenerateReport?: () => void;
  autoRedirectSeconds?: number;
}

export function ConsultationEndScreen({
  role,
  doctorName,
  onReturn,
  onGenerateReport,
  autoRedirectSeconds = 4,
}: ConsultationEndScreenProps) {
  const isDoctor = role === "doctor";
  const href = isDoctor ? "/medico/dashboard" : "/paciente";
  const label = isDoctor ? "Volver al consultorio" : "Volver al portal";
  const [redirectPaused, setRedirectPaused] = useState(false);

  const goBack = () => {
    if (onReturn) onReturn();
    else window.location.href = href;
  };

  useEffect(() => {
    if (autoRedirectSeconds <= 0 || redirectPaused) return;
    const timer = setTimeout(goBack, autoRedirectSeconds * 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRedirectSeconds, redirectPaused]);

  return (
    <div className="min-h-[320px] flex flex-col items-center justify-center bg-slate-50 text-center p-6 rounded-lg border border-slate-200">
      <CheckCircle className="h-12 w-12 text-emerald-500 mb-3" />
      <VideoOff className="h-8 w-8 text-slate-300 mb-2" />
      <h2 className="text-lg font-semibold text-slate-800">
        Videollamada finalizada
      </h2>
      <p className="text-sm text-slate-500 mt-2 max-w-sm">
        {isDoctor
          ? "Podés generar el informe clínico antes de volver al consultorio."
          : doctorName
            ? `Gracias por su consulta con Dr/a. ${doctorName}.`
            : "Gracias por utilizar Clínica Virtual."}
      </p>
      {autoRedirectSeconds > 0 && !redirectPaused && (
        <p className="text-xs text-slate-400 mt-2">
          Redirigiendo en unos segundos…
        </p>
      )}
      {isDoctor && onGenerateReport && (
        <Button
          className="mt-5 bg-violet-700 hover:bg-violet-800"
          onClick={() => {
            setRedirectPaused(true);
            onGenerateReport();
          }}
        >
          <FileText className="h-4 w-4 mr-2" />
          Generar informe clínico
        </Button>
      )}
      <Button
        variant={isDoctor && onGenerateReport ? "outline" : "default"}
        className={`mt-3 ${!isDoctor || !onGenerateReport ? (isDoctor ? "bg-blue-700 hover:bg-blue-800" : "bg-emerald-600 hover:bg-emerald-700") : ""}`}
        onClick={goBack}
      >
        <Home className="h-4 w-4 mr-2" />
        {label}
      </Button>
      <Link href={href} className="text-xs text-slate-400 mt-3 hover:underline">
        Ir ahora →
      </Link>
    </div>
  );
}
