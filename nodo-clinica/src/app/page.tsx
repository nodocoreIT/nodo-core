import Link from "next/link";
import {
  Stethoscope,
  Video,
  Calendar,
  FileText,
  Shield,
  Building2,
  Clock,
  Sparkles,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200/80 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 shadow-sm">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-semibold text-slate-900 text-lg leading-tight block">
                Clínica Virtual
              </span>
              <span className="text-xs text-slate-500">
                Telemedicina profesional
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login/paciente"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
              )}
            >
              Ingresar como paciente
            </Link>
            <Link
              href="/login/medico"
              className={cn(
                buttonVariants({ size: "sm" }),
                "bg-blue-700 hover:bg-blue-800"
              )}
            >
              Ingresar como médico
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent" />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
            <div className="max-w-2xl">
              <p className="text-blue-300 text-sm font-medium tracking-wide uppercase mb-4">
                Plataforma multi-médico
              </p>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
                Consultas médicas online con agenda, historial e informes con IA
              </h1>
              <p className="text-lg text-slate-300 mt-5 leading-relaxed">
                Los pacientes eligen profesional, reservan turno en calendario y
                se conectan por videollamada. Los médicos gestionan cola,
                recetas, estudios y documentación clínica desde un solo panel.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href="/login/paciente"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "bg-emerald-600 hover:bg-emerald-700 text-white"
                  )}
                >
                  Pedir turno
                </Link>
                <Link
                  href="/login/medico"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "border-white/30 text-white hover:bg-white/10 bg-transparent"
                  )}
                >
                  Acceso médicos
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-8 py-16">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">
            Todo lo que necesitás en una plataforma
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: Calendar,
                title: "Agenda inteligente",
                text: "El médico define días, horarios y duración de turnos. El paciente elige del calendario.",
              },
              {
                icon: Video,
                title: "Videoconsulta",
                text: "Salas Jitsi integradas para consultas en tiempo real desde PC o celular.",
              },
              {
                icon: FileText,
                title: "Documentación clínica",
                text: "Recetas, pedidos de estudio, historial y notas en el mismo consultorio digital.",
              },
              {
                icon: Sparkles,
                title: "Informes con IA",
                text: "Dictado por micrófono y generación automática de informes médicos estructurados.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 mb-4">
                  <Icon className="h-5 w-5 text-blue-700" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">
                  Para pacientes
                </h2>
                <ul className="space-y-3 text-slate-600">
                  <li className="flex gap-2">
                    <Clock className="h-5 w-5 text-emerald-600 shrink-0" />
                    Reservá turno online con el médico de tu preferencia
                  </li>
                  <li className="flex gap-2">
                    <Video className="h-5 w-5 text-emerald-600 shrink-0" />
                    Entrá a la sala de espera y conectate por videollamada
                  </li>
                  <li className="flex gap-2">
                    <Shield className="h-5 w-5 text-emerald-600 shrink-0" />
                    Subí estudios previos antes de la consulta
                  </li>
                </ul>
                <Link
                  href="/registro/paciente"
                  className={cn(
                    buttonVariants({ variant: "link" }),
                    "text-emerald-700 px-0 mt-4"
                  )}
                >
                  Crear cuenta de paciente →
                </Link>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">
                  Para médicos
                </h2>
                <ul className="space-y-3 text-slate-600">
                  <li className="flex gap-2">
                    <Stethoscope className="h-5 w-5 text-blue-700 shrink-0" />
                    Panel con cola de pacientes y consultorio completo
                  </li>
                  <li className="flex gap-2">
                    <Calendar className="h-5 w-5 text-blue-700 shrink-0" />
                    Configurá tu agenda, firma digital y duración de turnos
                  </li>
                  <li className="flex gap-2">
                    <Sparkles className="h-5 w-5 text-blue-700 shrink-0" />
                    Generá informes por dictado y enviá por email o WhatsApp
                  </li>
                </ul>
                <Link
                  href="/registro/medico"
                  className={cn(
                    buttonVariants({ variant: "link" }),
                    "text-blue-700 px-0 mt-4"
                  )}
                >
                  Registrarme como médico →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        Clínica Virtual — Plataforma de telemedicina
      </footer>
    </div>
  );
}
