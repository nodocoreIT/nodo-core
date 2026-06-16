"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { DoctorOfficePanel } from "@/components/medical/doctor-office-panel";
import { clinicApi } from "@/lib/clinic/client-api";
import { UserAvatar } from "@/components/ui/user-avatar";

export function LocalMedicoSettings() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<{
    id: string;
    fullName: string;
    specialty?: string;
    photo?: string;
  } | null>(null);

  useEffect(() => {
    clinicApi.getSession().then(({ session, user }) => {
      if (!session || session.role !== "doctor") {
        router.push("/login/medico");
        return;
      }
      setDoctor({
        id: user.id,
        fullName: user.fullName,
        specialty: user.specialty,
      });
      clinicApi.getDoctorSchedule(user.id).then((data) => {
        if (data.profilePhotoData) {
          setDoctor((prev) =>
            prev ? { ...prev, photo: data.profilePhotoData } : prev
          );
        }
      });
    });
  }, [router]);

  if (!doctor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/medico/dashboard"
              className="inline-flex shrink-0 items-center h-8 px-3 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Panel
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-slate-900 truncate">
                Configuración del consultorio
              </h1>
              <p className="text-xs text-slate-500">
                Agenda, perfil, cobros, recordatorios por email y calendario
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <UserAvatar name={doctor.fullName} photoUrl={doctor.photo} size="sm" />
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-slate-800">
                Dr/a. {doctor.fullName}
              </p>
              {doctor.specialty && (
                <p className="text-xs text-slate-400">{doctor.specialty}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 pb-12">
        <DoctorOfficePanel doctorId={doctor.id} fullPage />
      </main>
    </div>
  );
}
