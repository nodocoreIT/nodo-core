import Link from "next/link";
import {
  Stethoscope,
  Video,
  Calendar,
  FileText,
  MessageSquare,
  Sparkles,
  Shield,
  Clock,
} from "lucide-react";
import { EcosystemDiagram } from "@/components/nodo/ecosystem-diagram";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-mist bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-900">
              <Stethoscope className="h-5 w-5 text-brand" strokeWidth={2} />
            </div>
            <div>
              <span className="font-display font-bold text-navy text-lg leading-tight block">
                nodo<span className="text-brand">salud</span>
              </span>
              <span className="text-xs text-slate2">
                Clínica Virtual · Telemedicina
              </span>
            </div>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center px-5 py-2.5 text-[14px] font-semibold rounded-md bg-brand text-white shadow-sm hover:bg-brand-600 active:scale-[.98] transition-all"
          >
            Ingresar
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-navy-900 text-white">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(70% 50% at 30% 30%, rgba(218,90,14,.22), transparent 70%)",
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-8 py-14 sm:py-20">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <p className="text-brand-300 text-sm font-bold tracking-wide uppercase mb-4">
                  Plataforma multi-médico
                </p>
                <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                  Consultas médicas online con agenda, historial e informes con IA
                </h1>
                <p className="text-[15px] leading-relaxed mt-5 max-w-xl" style={{ color: "rgba(234,240,247,.75)" }}>
                  Los pacientes eligen profesional, reservan turno en calendario y
                  se conectan por videollamada. Los médicos gestionan cola, recetas,
                  interconsultas entre colegas y documentación clínica desde un solo
                  panel Nodo.
                </p>
                <div className="flex flex-wrap gap-3 mt-8">
                  <Link
                    href="/login"
                    className="inline-flex items-center px-6 py-3 rounded-md bg-brand text-white font-semibold text-[15px] hover:bg-brand-600 transition-all shadow-md"
                  >
                    Ingresar al portal
                  </Link>
                  <Link
                    href="/login/paciente"
                    className="inline-flex items-center px-6 py-3 rounded-md border border-white/30 text-white font-semibold text-[15px] hover:bg-white/10 transition-all"
                  >
                    Pedir turno
                  </Link>
                </div>
              </div>
              <div className="hidden lg:block">
                <EcosystemDiagram
                  dark
                  activeNodeSlug="salud"
                  className="w-full max-w-[380px] aspect-square mx-auto"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-8 py-16">
          <h2 className="font-display text-2xl font-bold text-navy text-center mb-10">
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
                icon: MessageSquare,
                title: "Interconsultas",
                text: "Chat interno entre médicos: consultá a colegas en vivo y mirá quién está online.",
              },
              {
                icon: Sparkles,
                title: "Informes con IA",
                text: "Dictado por micrófono y generación automática de informes médicos estructurados.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-md border border-mist bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 mb-4">
                  <Icon className="h-5 w-5 text-brand" />
                </div>
                <h3 className="font-display font-bold text-navy mb-2">{title}</h3>
                <p className="text-sm text-slate2 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border-y border-mist">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
            <div className="grid md:grid-cols-2 gap-10">
              <div>
                <h2 className="font-display text-xl font-bold text-navy mb-4">
                  Para pacientes
                </h2>
                <ul className="space-y-3 text-slate2 text-sm">
                  <li className="flex gap-2">
                    <Clock className="h-5 w-5 text-brand shrink-0" />
                    Reservá turno online con el médico de tu preferencia
                  </li>
                  <li className="flex gap-2">
                    <Video className="h-5 w-5 text-brand shrink-0" />
                    Entrá a la sala de espera y conectate por videollamada
                  </li>
                  <li className="flex gap-2">
                    <Shield className="h-5 w-5 text-brand shrink-0" />
                    Subí estudios previos antes de la consulta
                  </li>
                </ul>
                <Link href="/login/paciente" className="inline-block text-brand font-semibold text-sm mt-4 hover:underline">
                  Ingresar como paciente →
                </Link>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-navy mb-4">
                  Para médicos
                </h2>
                <ul className="space-y-3 text-slate2 text-sm">
                  <li className="flex gap-2">
                    <Stethoscope className="h-5 w-5 text-brand shrink-0" />
                    Panel con cola de pacientes y consultorio completo
                  </li>
                  <li className="flex gap-2">
                    <MessageSquare className="h-5 w-5 text-brand shrink-0" />
                    Chat de interconsultas con colegas y estado en línea
                  </li>
                  <li className="flex gap-2">
                    <FileText className="h-5 w-5 text-brand shrink-0" />
                    Recetas, estudios e informes con dictado e IA
                  </li>
                </ul>
                <Link href="/login/medico" className="inline-block text-brand font-semibold text-sm mt-4 hover:underline">
                  Ingresar como médico →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-mist py-8 text-center text-sm text-slate2">
        © 2026 Nodo Core · Clínica Virtual · Transparencia tecnológica
      </footer>
    </div>
  );
}
