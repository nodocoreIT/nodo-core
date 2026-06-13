"use client";

import Link from "next/link";
import {
  Building2,
  Calendar,
  Video,
  FileText,
  Sparkles,
  Clock,
  Shield,
  Stethoscope,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";

export default function ClinicaVirtualPage() {
  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: "var(--color-navy-900)" }}
    >
      <Navbar />

      <main>
        {/* Sub-Header / Hero Breadcrumb */}
        <div
          className="border-b border-white/5 py-4"
          style={{ backgroundColor: "rgba(13, 23, 34, 0.4)" }}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-8 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Link
                href="/nodo-salud"
                className="text-slate2-300 hover:text-brand transition-colors font-medium"
              >
                NODO | Salud
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-white/30" />
              <span className="text-brand font-semibold">Clínica Virtual</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[12px] font-bold text-emerald-400 uppercase tracking-wider">
                Módulo Activo
              </span>
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-16 sm:py-24 border-b border-white/5">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 55% at 50% 38%, rgba(218,90,14,.15), transparent 75%)",
            }}
          />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-8">
            <div className="max-w-3xl">
              <p className="text-brand-300 text-xs sm:text-sm font-bold tracking-widest uppercase mb-4">
                Plataforma Multi-Médico · Clinica Virtual
              </p>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white">
                Consultas médicas online con agenda, historial de pacientes e
                informes automatizados.
              </h1>

              <p
                className="text-[16px] sm:text-lg mt-5 leading-relaxed"
                style={{ color: "rgba(234,240,247,.72)" }}
              >
                Los pacientes eligen profesional, reservan turno en el
                calendario y se conectan por videollamada. Los médicos gestionan
                cola de espera, recetas, estudios y documentación clínica desde
                un solo panel integrado.
              </p>

              <div className="flex flex-wrap gap-4 mt-8">
                <Link
                  href="/nodo-clinica/login"
                  className="inline-flex items-center justify-center px-6 py-3 text-sm font-bold rounded-lg bg-brand text-white hover:bg-brand-600 active:scale-[.98] transition-all duration-150 shadow-lg shadow-brand/20"
                >
                  Entrar a Clínica Virtual
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-20">
          <div className="text-center mb-12">
            <p className="text-brand text-xs sm:text-sm font-bold uppercase tracking-wider mb-2">
              Funcionalidades Clave
            </p>
            <h2 className="font-display font-extrabold text-white text-[26px] sm:text-3xl">
              Todo lo que necesitás en una plataforma
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div
              className="rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              style={{
                background: "var(--color-navy-700)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10 text-brand mb-5">
                <Calendar className="h-5.5 w-5.5" />
              </div>
              <h3 className="font-display font-bold text-white text-[17px] mb-2">
                Agenda inteligente
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(234,240,247,.65)" }}
              >
                El médico define días, horarios y duración de turnos. El
                paciente elige directamente desde el calendario interactivo.
              </p>
            </div>

            {/* Feature 2 */}
            <div
              className="rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              style={{
                background: "var(--color-navy-700)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10 text-brand mb-5">
                <Video className="h-5.5 w-5.5" />
              </div>
              <h3 className="font-display font-bold text-white text-[17px] mb-2">
                Videoconsulta
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(234,240,247,.65)" }}
              >
                Salas de comunicación encriptadas integradas para realizar
                consultas virtuales fluidas desde PC o celular.
              </p>
            </div>

            {/* Feature 3 */}
            <div
              className="rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              style={{
                background: "var(--color-navy-700)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10 text-brand mb-5">
                <FileText className="h-5.5 w-5.5" />
              </div>
              <h3 className="font-display font-bold text-white text-[17px] mb-2">
                Documentación clínica
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(234,240,247,.65)" }}
              >
                Administración centralizada de recetas, pedidos de estudio,
                historial clínico y notas en la misma sesión digital.
              </p>
            </div>

            {/* Feature 4 */}
            <div
              className="rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              style={{
                background: "var(--color-navy-700)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10 text-brand mb-5">
                <Sparkles className="h-5.5 w-5.5" />
              </div>
              <h3 className="font-display font-bold text-white text-[17px] mb-2">
                Informes con IA
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(234,240,247,.65)" }}
              >
                Dictado por micrófono en tiempo real y generación automatizada
                de informes médicos estructurados bajo formato SOAP.
              </p>
            </div>
          </div>
        </section>

        {/* Workflows Split Section */}
        <section
          className="border-t border-b border-white/5"
          style={{ backgroundColor: "var(--color-navy)" }}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* Left Column: Pacientes */}
              <div className="flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 inline-block mb-4">
                    Rol Paciente
                  </span>
                  <h3 className="text-2xl font-bold text-white mb-6">
                    Para Pacientes
                  </h3>

                  <ul className="space-y-5">
                    <li className="flex gap-3 items-start">
                      <div className="h-5.5 w-5.5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Clock className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm sm:text-base text-slate2-300 leading-relaxed">
                        Reservá turno online con el médico de tu preferencia en
                        pocos clics.
                      </span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <div className="h-5.5 w-5.5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Video className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm sm:text-base text-slate2-300 leading-relaxed">
                        Entrá a la sala de espera virtual y conectate por
                        videollamada segura.
                      </span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <div className="h-5.5 w-5.5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Shield className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm sm:text-base text-slate2-300 leading-relaxed">
                        Subí de forma segura estudios médicos previos antes de
                        tu consulta.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 pt-4">
                  <Link
                    href="/login?node=clinica-virtual&mode=register&role=paciente"
                    className="inline-flex items-center gap-2 text-emerald-400 font-semibold hover:text-emerald-300 transition-colors"
                  >
                    Crear cuenta de paciente <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Right Column: Medicos */}
              <div className="flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-300 bg-brand/10 px-2.5 py-0.5 rounded-full border border-brand/20 inline-block mb-4">
                    Rol Profesional
                  </span>
                  <h3 className="text-2xl font-bold text-white mb-6">
                    Para Médicos
                  </h3>

                  <ul className="space-y-5">
                    <li className="flex gap-3 items-start">
                      <div className="h-5.5 w-5.5 rounded-full bg-brand/10 text-brand-300 flex items-center justify-center shrink-0 mt-0.5">
                        <Stethoscope className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm sm:text-base text-slate2-300 leading-relaxed">
                        Panel centralizado con cola de pacientes en espera y
                        consultorio virtual completo.
                      </span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <div className="h-5.5 w-5.5 rounded-full bg-brand/10 text-brand-300 flex items-center justify-center shrink-0 mt-0.5">
                        <Calendar className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm sm:text-base text-slate2-300 leading-relaxed">
                        Configuración flexible de tu agenda, firma digital y
                        duración personalizada de turnos.
                      </span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <div className="h-5.5 w-5.5 rounded-full bg-brand/10 text-brand-300 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm sm:text-base text-slate2-300 leading-relaxed">
                        Generación de informes médicos y recetas por dictado
                        inteligente de voz, listos para envío por email o
                        WhatsApp.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 pt-4">
                  <Link
                    href="/login?node=clinica-virtual&mode=register&role=medico"
                    className="inline-flex items-center gap-2 text-brand font-semibold hover:text-brand-300 transition-colors"
                  >
                    Registrarme como médico <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
