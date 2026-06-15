import { useEffect, useState } from "react";
import { Input } from "@nodocore/shared-components";
import { Badge } from "@/shared/components/ui/badge";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Search, Loader2, History, Paperclip } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { UserAvatar } from "@/shared/components/ui/user-avatar";
import { supabase } from "@/shared/lib/supabase";

interface PatientSearchResult {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  stats: {
    appointments: number;
    documents: number;
    clinicalRecords: number;
  };
  lastAppointment?: string;
}

interface PatientSearchPanelProps {
  doctorId: string;
  onSelectPatient: (patient: {
    patientId: string;
    patientName: string;
    patientEmail?: string;
    patientPhone?: string;
  }) => void;
}

async function searchPatients(
  doctorId: string,
  query: string
): Promise<PatientSearchResult[]> {
  const { data: appointments } = await supabase
    .from("appointments")
    .select(`
      patient_id,
      scheduled_at,
      patients!inner(
        id,
        profile:profiles!profile_id(full_name, email)
      )
    `)
    .eq("doctor_id", doctorId)
    .order("scheduled_at", { ascending: false });

  if (!appointments) return [];

  const seen = new Map<string, PatientSearchResult>();
  for (const apt of appointments) {
    const patient = apt.patients as unknown as {
      id: string;
      profile: { full_name: string; email: string } | null;
    };
    if (!patient?.profile) continue;

    const name = patient.profile.full_name;
    const email = patient.profile.email;

    if (
      query &&
      !name.toLowerCase().includes(query.toLowerCase()) &&
      !email.toLowerCase().includes(query.toLowerCase())
    ) {
      continue;
    }

    if (!seen.has(patient.id)) {
      seen.set(patient.id, {
        id: patient.id,
        fullName: name,
        email,
        lastAppointment: apt.scheduled_at,
        stats: { appointments: 1, documents: 0, clinicalRecords: 0 },
      });
    } else {
      const existing = seen.get(patient.id)!;
      existing.stats.appointments += 1;
    }
  }

  return Array.from(seen.values());
}

export function PatientSearchPanel({
  doctorId,
  onSelectPatient,
}: PatientSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PatientSearchResult[]>([]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      searchPatients(doctorId, query)
        .then((data) => setResults(data))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [doctorId, query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o email..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : results.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">
          {query ? "Sin resultados" : "No hay pacientes registrados todavía"}
        </p>
      ) : (
        <ScrollArea className="h-[420px] pr-2">
          <div className="space-y-2">
            {results.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() =>
                  onSelectPatient({
                    patientId: patient.id,
                    patientName: patient.fullName,
                    patientEmail: patient.email,
                    patientPhone: patient.phone,
                  })
                }
                className="w-full text-left rounded-lg border border-slate-100 bg-white p-3 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar name={patient.fullName} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {patient.fullName}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {patient.email}
                    </p>
                    {patient.lastAppointment && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Último turno:{" "}
                        {format(new Date(patient.lastAppointment), "dd MMM yyyy", {
                          locale: es,
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2 ml-11">
                  {patient.stats.clinicalRecords > 0 && (
                    <Badge variant="outline" className="text-[10px] h-5">
                      <History className="h-3 w-3 mr-1" />
                      {patient.stats.clinicalRecords}
                    </Badge>
                  )}
                  {patient.stats.documents > 0 && (
                    <Badge variant="outline" className="text-[10px] h-5 border-amber-200">
                      <Paperclip className="h-3 w-3 mr-1" />
                      {patient.stats.documents}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
