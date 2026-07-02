"use client";

import Link from "next/link";
import { Stethoscope, User } from "lucide-react";
import LoginBrandPanel from "@/components/LoginBrandPanel";
import { getLoginPanelDetails } from "@/lib/login-panel";
import { applyLoginAccent, getLoginAccent } from "@/lib/node-accents";
import { useEffect } from "react";

/**
 * Login visual al estilo Nodo Inmo cuando el proyecto Clínica aún no tiene
 * Supabase Auth en el landing (modo demo / CLINIC_MODE=local en la app).
 */
export function ClinicaLocalLoginEntry({ nodeParam }: { nodeParam: string }) {
  const loginAccent = getLoginAccent(nodeParam);
  const loginPanel = getLoginPanelDetails(nodeParam);

  useEffect(() => applyLoginAccent(loginAccent), [loginAccent]);

  return (
    <div className="min-h-screen grid grid-cols-1 login-split">
      <LoginBrandPanel accent={loginAccent} {...loginPanel} />

      <main className="flex items-center justify-center p-8 bg-paper min-h-screen">
        <div className="w-[min(420px,100%)]">
          <span
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em]"
            style={{ color: loginAccent.brand }}
          >
            ◎ NODO CLÍNICA
          </span>

          <h1 className="font-display font-bold text-ink text-[26px] mt-2 mb-1">
            Ingresar al portal
          </h1>
          <p className="text-slate2 text-[14.5px] mb-6">
            Elegí si sos profesional de la salud o paciente.
          </p>

          <div className="flex flex-col gap-4">
            <Link
              href="/clinica/login/medico"
              className="flex items-start gap-4 rounded-xl border border-mist bg-white p-5 text-left transition-all duration-150 hover:shadow-md hover:border-brand"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-900">
                <Stethoscope className="h-5 w-5 text-white" strokeWidth={1.75} />
              </span>
              <span>
                <span className="block font-bold text-ink text-[16px]">Soy médico</span>
                <span className="block text-slate2 text-[13px] mt-0.5">
                  Panel de consultorio, agenda y cobros
                </span>
              </span>
            </Link>

            <Link
              href="/clinica/login/paciente"
              className="flex items-start gap-4 rounded-xl border border-mist bg-white p-5 text-left transition-all duration-150 hover:shadow-md hover:border-brand"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-900">
                <User className="h-5 w-5 text-white" strokeWidth={1.75} />
              </span>
              <span>
                <span className="block font-bold text-ink text-[16px]">Soy paciente</span>
                <span className="block text-slate2 text-[13px] mt-0.5">
                  Turnos, sala de espera y videoconsulta
                </span>
              </span>
            </Link>
          </div>

          <p className="text-[12px] text-slate2 mt-8 leading-relaxed">
            Cuando activemos Supabase para Clínica en este dominio, acá vas a ver el
            login con Google y correo como en Nodo Inmo.
          </p>

          <Link
            href="/nodo-clinica"
            className="inline-block mt-4 text-[13px] font-semibold text-brand hover:underline"
          >
            ← Volver a Nodo Clínica
          </Link>
        </div>
      </main>
    </div>
  );
}
