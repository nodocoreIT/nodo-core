"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, User } from "lucide-react";
import { clinicApi } from "@/lib/clinic/client-api";
import { useRouter } from "next/navigation";

interface PatientSearchResult {
  id: string;
  fullName: string;
  email: string;
  dni?: string;
  lastAppointmentAt?: string;
}

export function PatientSearchModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await clinicApi.searchPatients(q);
      setResults(res);
    } catch (err) {
      console.error("Search error:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelectPatient = (patient: PatientSearchResult) => {
    onOpenChange(false);
    // Navigate to patient detail or history page
    router.push(`/medico/pacientes/${patient.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buscar paciente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Nombre, email o DNI..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              </div>
            )}

            {!loading && query.trim() === "" && (
              <p className="text-sm text-slate-400 text-center py-8">
                Escribí el nombre, email o DNI del paciente
              </p>
            )}

            {!loading && query.trim() !== "" && results.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                No encontramos pacientes con ese criterio
              </p>
            )}

            {!loading && results.length > 0 && (
              <div className="space-y-1">
                {results.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left"
                  >
                    <User className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">
                        {patient.fullName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {patient.email}
                      </p>
                      {patient.dni && (
                        <p className="text-xs text-slate-400">DNI: {patient.dni}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
