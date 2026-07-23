"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Stethoscope, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";
import { SpecialtyCombobox } from "@/components/ui/specialty-combobox";
import { NeuralNodesBackground } from "@/components/ui/neural-nodes-background";
import { ONBOARDING_PLANS, formatPlanPrice } from "@/lib/clinic/subscription-plans";
import { PhoneVerificationField } from "@/components/onboarding/phone-verification-field";

const inputClass =
  "mt-1 w-full rounded-lg px-3 py-2.5 text-sm bg-white border border-slate-200 text-navy placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 transition-shadow";
const labelClass = "text-xs font-medium text-slate-300";

function OnboardingMedicoContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [plan, setPlan] = useState("trial");
  const [form, setForm] = useState({
    fullName: "",
    specialty: "Medicina General",
    licenseNumber: "",
  });
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneSkipped, setPhoneSkipped] = useState(false);
  const canSubmitPhone = phoneVerified || phoneSkipped;

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="rounded-2xl border border-red-200 bg-white p-8 max-w-md w-full text-center shadow-lg">
          <p className="text-red-600 font-medium">Link de onboarding inválido.</p>
          <p className="text-slate-500 text-sm mt-2">
            Revisá tu correo y hacé clic en el link de verificación para continuar.
          </p>
          <Link href="/registro/medico" className="mt-4 inline-block text-teal-600 underline text-sm">
            Volver al registro
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.specialty) {
      toast.error("El nombre completo y la especialidad son requeridos.");
      return;
    }
    if (!canSubmitPhone) {
      toast.error("Verificá tu celular o marcá omitir este campo para continuar.");
      return;
    }
    setLoading(true);
    try {
      await clinicApi.completeOnboardingMedico({
        fullName: form.fullName,
        specialty: form.specialty,
        licenseNumber: form.licenseNumber,
        plan,
        token,
        skipPhoneVerification: phoneSkipped,
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al completar el registro");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen py-10 px-4">
      <NeuralNodesBackground />
      <div className="relative z-10 mx-auto w-full max-w-5xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-5 flex flex-col items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 border border-teal-200 text-teal-600">
              <Stethoscope className="h-6 w-6" />
            </span>
            <div className="flex items-center gap-[0.4em]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/nodo ver clinica.png" alt="NODO" style={{ height: "clamp(22px, 2.4vw, 28px)", width: "auto" }} className="inline-block shrink-0" />
              <span className="font-light leading-none text-white/30" style={{ fontSize: "clamp(22px, 2.4vw, 28px)" }}>|</span>
              <span className="font-display font-extrabold text-white" style={{ fontSize: "clamp(22px, 2.4vw, 28px)", lineHeight: 1.1 }}>Clínica</span>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-white">Completá tu registro</h1>
          <p className="text-sm mt-2 max-w-lg mx-auto" style={{ color: "rgba(234,240,247,.55)" }}>
            Datos profesionales y plan. La contraseña la configurás al primer ingreso, una vez habilitada tu cuenta.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border p-6 md:p-10 shadow-2xl backdrop-blur-md" style={{ background: "rgba(27,42,65,0.88)", borderColor: "rgba(255,255,255,.1)", boxShadow: "0 24px 80px rgba(0,0,0,.35)" }}>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Row 1: Nombre + Matrícula */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="fullName" className={labelClass}>Nombre completo</label>
                <input
                  id="fullName"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Dr/a. Juan García"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="licenseNumber" className={labelClass}>Matrícula (opcional)</label>
                <input
                  id="licenseNumber"
                  value={form.licenseNumber}
                  onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                  placeholder="MN 12345"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Row 2: Especialidad */}
            <div>
              <label className={labelClass}>Especialidad</label>
              <div className="mt-1">
                <SpecialtyCombobox
                  value={form.specialty}
                  onChange={(val) => setForm({ ...form, specialty: val })}
                />
              </div>
            </div>

            <PhoneVerificationField
              onboardingToken={token}
              labelClass={labelClass}
              onVerifiedChange={setPhoneVerified}
              onSkipChange={setPhoneSkipped}
            />

            {/* Planes */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Plan de suscripción</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {ONBOARDING_PLANS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlan(p.id)}
                    className={`rounded-lg px-4 py-4 text-left border font-medium transition-all ${
                      plan === p.id
                        ? "border-teal-500 bg-white text-navy ring-1 ring-teal-400 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-teal-300"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{p.name}</span>
                    <span className={`block text-base font-bold mt-1 ${plan === p.id ? "text-teal-600" : "text-slate-500"}`}>
                      {formatPlanPrice(p)} <span className="text-xs font-normal text-slate-400">{p.period}</span>
                    </span>
                    <ul className="mt-2 space-y-1">
                      {p.features.map((f) => (
                        <li key={f} className="text-xs text-slate-400 flex items-center gap-1">
                          <span className={plan === p.id ? "text-teal-500" : "text-slate-300"}>✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !canSubmitPhone}
              className="w-full rounded-lg py-3.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar y solicitar habilitación"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: "rgba(234,240,247,.4)" }}>
          <a className="underline hover:text-white" href="/">Volver al inicio</a>
        </p>
      </div>

      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 flex flex-col items-center gap-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100">
              <CheckCircle className="h-8 w-8 text-teal-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">¡Registro completado!</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Pronto desde NODO activaremos tu cuenta. Una vez habilitada, vas a poder iniciar sesión con tu email y contraseña.
            </p>
            <a
              href="/login"
              className="mt-2 inline-flex items-center justify-center rounded-md bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
            >
              Ir al inicio de sesión
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OnboardingMedicoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <OnboardingMedicoContent />
    </Suspense>
  );
}
