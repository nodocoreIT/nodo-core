import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  Button,
  useAuth,
} from "@nodocore/shared-components";
import { ClipboardList, Download, Loader2, Pill } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/shared/lib/supabase";
import { jsPDF } from "jspdf";
import type { Medication } from "@/types";

interface PrescriptionRow {
  id: string;
  created_at: string;
  medications: Medication[];
  patient: { profile: { full_name: string; email: string } | null } | null;
  appointment: { scheduled_at: string } | null;
}

function generatePrescriptionPdf(
  prescription: PrescriptionRow,
  doctorName: string,
  doctorSpecialty?: string,
  doctorLicense?: string,
) {
  const patientName = prescription.patient?.profile?.full_name ?? "Paciente";
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("RECETA MÉDICA", 105, 20, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Dr/a. ${doctorName}`, 20, 35);
  if (doctorSpecialty) doc.text(doctorSpecialty, 20, 41);
  if (doctorLicense) doc.text(`Mat. ${doctorLicense}`, 20, 47);
  doc.line(20, 52, 190, 52);

  doc.setFont("helvetica", "bold");
  doc.text(`Paciente: ${patientName}`, 20, 60);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Fecha: ${format(new Date(prescription.created_at), "dd/MM/yyyy")}`,
    20,
    66,
  );
  doc.line(20, 71, 190, 71);

  let y = 80;
  prescription.medications.forEach((med: Medication, i: number) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}. ${med.name}`, 20, y);
    doc.setFont("helvetica", "normal");
    y += 6;
    doc.text(
      `   Dosis: ${med.dosage}  |  Frecuencia: ${med.frequency}  |  Duración: ${med.duration}`,
      20,
      y,
    );
    if (med.instructions) {
      y += 5;
      doc.text(`   Indicaciones: ${med.instructions}`, 20, y);
    }
    y += 10;
  });

  doc.save(`receta-${patientName.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(prescription.created_at), "yyyy-MM-dd")}.pdf`);
}

export function RecetasPage() {
  const { session } = useAuth();
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctorProfile, setDoctorProfile] = useState<{
    full_name: string;
    specialty?: string;
    license_number?: string;
  } | null>(null);

  useEffect(() => {
    if (!session?.user.id) return;

    const fetchData = async () => {
      const [{ data: profile }, { data: rxData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, specialty, license_number")
          .eq("id", session.user.id)
          .single(),
        supabase
          .from("prescriptions")
          .select(`
            id,
            created_at,
            medications,
            patient:patients!patient_id(
              profile:profiles!profile_id(full_name, email)
            ),
            appointment:appointments!appointment_id(scheduled_at)
          `)
          .eq("doctor_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      setDoctorProfile(profile);
      setPrescriptions((rxData ?? []) as unknown as PrescriptionRow[]);
      setLoading(false);
    };

    void fetchData();
  }, [session?.user.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <ClipboardList className="h-5 w-5 text-brand" />
        <h2 className="text-lg font-semibold text-navy">Historial de recetas</h2>
        <span className="text-sm text-slate2 ml-auto">
          {prescriptions.length} receta{prescriptions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {prescriptions.length === 0 ? (
        <div className="text-center py-16">
          <Pill className="h-12 w-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Sin recetas emitidas</p>
          <p className="text-sm text-slate-400 mt-1">
            Las recetas emitidas durante las consultas aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {prescriptions.map((rx) => {
            const patientName = rx.patient?.profile?.full_name ?? "Paciente";
            const medCount = rx.medications?.length ?? 0;
            const dateLabel = format(new Date(rx.created_at), "d 'de' MMMM yyyy", {
              locale: es,
            });

            return (
              <Card key={rx.id} className="border-slate-200">
                <CardContent className="py-3 px-4 flex items-center gap-4">
                  <div className="h-9 w-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <Pill className="h-4 w-4 text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {patientName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {dateLabel} ·{" "}
                      {medCount} medicamento{medCount !== 1 ? "s" : ""}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {rx.medications?.slice(0, 3).map((med: Medication, i: number) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
                        >
                          {med.name}
                        </span>
                      ))}
                      {medCount > 3 && (
                        <span className="text-[10px] text-slate-400">
                          +{medCount - 3} más
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() =>
                      generatePrescriptionPdf(
                        rx,
                        doctorProfile?.full_name ?? "",
                        doctorProfile?.specialty,
                        doctorProfile?.license_number,
                      )
                    }
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    PDF
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
