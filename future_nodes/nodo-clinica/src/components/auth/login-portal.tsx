"use client";

import { useState } from "react";
import Link from "next/link";
import { Stethoscope, User, ArrowLeft } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export function LoginPortal() {
  const [role, setRole] = useState<"doctor" | "patient" | null>(null);

  if (role) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setRole(null)}
          className="fixed top-[22px] left-[22px] z-20 inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold rounded-md border border-mist bg-white text-slate2 hover:text-navy hover:border-brand/40 transition-colors shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Elegir portal
        </button>
        <LoginForm defaultRole={role} unified />
      </div>
    );
  }

  return (
    <>
      <Link
        href="/"
        className="fixed top-[22px] right-[22px] z-10 inline-flex items-center gap-2 px-4 py-2 text-[14px] font-semibold rounded-md bg-brand text-white shadow-sm hover:bg-brand-600 active:scale-[.98] transition-all duration-150"
      >
        ← Volver a la web
      </Link>

      <div className="min-h-screen flex items-center justify-center bg-paper p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-brand">
              ◎ Nodo Salud · Clínica Virtual
            </span>
            <h1 className="font-display font-bold text-ink text-[28px] mt-3 mb-2">
              Ingresar al portal
            </h1>
            <p className="text-slate2 text-[14.5px]">
              Elegí si sos profesional de la salud o paciente para continuar.
            </p>
          </div>

          <div className="grid gap-4">
            <button
              type="button"
              onClick={() => setRole("doctor")}
              className="group flex items-start gap-4 rounded-lg border-2 border-mist bg-white p-5 text-left transition-all hover:border-brand hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-brand group-hover:bg-brand group-hover:text-white transition-colors">
                <Stethoscope className="h-6 w-6" />
              </div>
              <div>
                <p className="font-display font-bold text-navy text-lg">
                  Soy Médico
                </p>
                <p className="text-sm text-slate2 mt-1 leading-relaxed">
                  Consultorio digital, cola de pacientes, interconsultas entre
                  colegas e informes clínicos.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRole("patient")}
              className="group flex items-start gap-4 rounded-lg border-2 border-mist bg-white p-5 text-left transition-all hover:border-brand hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-brand group-hover:bg-brand group-hover:text-white transition-colors">
                <User className="h-6 w-6" />
              </div>
              <div>
                <p className="font-display font-bold text-navy text-lg">
                  Soy Paciente
                </p>
                <p className="text-sm text-slate2 mt-1 leading-relaxed">
                  Reservá turno online, subí estudios y conectate por
                  videollamada con tu médico.
                </p>
              </div>
            </button>
          </div>

          <p className="text-center text-xs text-slate2 mt-8">
            Seleccioná un portal para iniciar sesión o registrarte.
          </p>
        </div>
      </div>
    </>
  );
}
