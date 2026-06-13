"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";

function VerificadoContent() {
  const searchParams = useSearchParams();
  const node = searchParams.get("node") || "salud";
  const role = searchParams.get("role") || "";

  const isInmo = node === "inmo";
  const isPatient = role === "paciente";

  return (
    <div
      className="relative z-10 w-[min(480px,100%)] text-center p-8 rounded-2xl border border-white/5"
      style={{ backgroundColor: "rgba(27, 42, 65, 0.4)" }}
    >
      <div className="h-16 w-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
        <CheckCircle2 className="h-8 w-8 animate-pulse" />
      </div>

      <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2">
        Verificación Exitosa
      </p>

      <h1 className="font-display font-extrabold text-white text-3xl mb-4 leading-tight">
        ¡Tu cuenta ha sido verificada!
      </h1>

      <p className="text-slate2-300 text-sm leading-relaxed mb-8">
        {isInmo ? (
          <>
            Tu solicitud de registro en <strong>NODO | Inmo</strong> fue
            verificada con éxito. Tu cuenta ya está activa en el sistema y podés
            ingresar al portal inmobiliario.
          </>
        ) : isPatient ? (
          <>
            Tu cuenta de paciente en <strong>NODO | Clínica Virtual</strong> ha
            sido activada correctamente. Ya podés iniciar sesión para agendar
            tus turnos y videoconsultas.
          </>
        ) : (
          <>
            Tu solicitud de registro en <strong>NODO | Clínica Virtual</strong>{" "}
            fue enviada con éxito. Ya figura en el panel de control de{" "}
            <strong>NODO Core</strong>. Un administrador del ecosistema activará
            tu consultorio a la brevedad.
          </>
        )}
      </p>

      <div className="flex flex-col gap-3">
        <Link
          href="/nodo-clinica/login"
          className="w-full inline-flex items-center justify-center px-6 py-3 text-sm font-bold rounded-lg bg-brand text-white hover:bg-brand-600 active:scale-[.98] transition-all duration-150 shadow-lg shadow-brand/20"
        >
          Ingresar
        </Link>
      </div>
    </div>
  );
}

export default function VerificadoPage() {
  return (
    <div
      className="min-h-screen text-white flex flex-col justify-between"
      style={{ backgroundColor: "var(--color-navy-900)" }}
    >
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-6 relative overflow-hidden py-24">
        {/* Glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 55% at 50% 50%, rgba(16, 185, 129, 0.12), transparent 70%)",
          }}
        />

        <Suspense fallback={<div className="text-white">Cargando...</div>}>
          <VerificadoContent />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
