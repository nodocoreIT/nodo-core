"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Stethoscope, Loader2, CreditCard, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";
import { SpecialtyCombobox } from "@/components/ui/specialty-combobox";

const PLANS = [
  {
    id: "trial",
    name: "Prueba gratis",
    price: "$0",
    period: "30 días",
    features: ["Hasta 20 consultas/mes", "Recetas PDF", "1 especialidad"],
  },
  {
    id: "basico",
    name: "Básico",
    price: "$9.900",
    period: "/mes",
    features: ["Consultas ilimitadas", "Recetas + estudios", "Soporte email"],
  },
  {
    id: "profesional",
    name: "Profesional",
    price: "$19.900",
    period: "/mes",
    features: ["Todo lo anterior", "Resumen SOAP con IA", "Multi-dispositivo"],
  },
];

const inputClass =
  "mt-1 w-full rounded-lg px-3 py-2.5 text-sm bg-white border border-slate-200 text-navy placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 transition-shadow";
const labelClass = "text-xs font-medium text-slate-600";

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

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="rounded-2xl border border-red-200 bg-white p-8 max-w-md w-full text-center shadow-lg">
          <p className="text-red-600 font-medium">Link de onboarding inválido.</p>
          <p className="text-slate-500 text-sm mt-2">
            Revisá tu correo electrónico y hacé clic en el link de verificación para continuar.
          </p>
          <Link
            href="/registro/medico"
            className="mt-4 inline-block text-teal-600 underline text-sm"
          >
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
    setLoading(true);
    try {
      await clinicApi.completeOnboardingMedico({
        fullName: form.fullName,
        specialty: form.specialty,
        licenseNumber: form.licenseNumber,
        plan,
        token,
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al completar el registro",
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4 flex flex-col items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 border border-teal-200 text-teal-600">
              <Stethoscope className="h-6 w-6" />
            </span>
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/nodo ver clinica.png"
                alt="NODO"
                style={{ height: "24px", width: "auto" }}
              />
              <span className="text-slate-300 font-light text-2xl">|</span>
              <span className="font-display font-extrabold text-navy text-2xl">Clínica</span>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-navy">Completá tu registro</h1>
          <p className="text-sm mt-2 text-slate-500 max-w-md mx-auto">
            Un último paso para empezar a atender pacientes y gestionar tus consultas.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 md:p-10 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nombre completo */}
            <div>
              <label htmlFor="fullName" className={labelClass}>
                Nombre completo
              </label>
              <input
                id="fullName"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Dr/a. Juan García"
                className={inputClass}
              />
            </div>

            {/* Especialidad + Matrícula */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Especialidad</label>
                <div className="mt-1">
                  <SpecialtyCombobox
                    value={form.specialty}
                    onChange={(val) => setForm({ ...form, specialty: val })}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="licenseNumber" className={labelClass}>
                  Matrícula (opcional)
                </label>
                <input
                  id="licenseNumber"
                  value={form.licenseNumber}
                  onChange={(e) =>
                    setForm({ ...form, licenseNumber: e.target.value })
                  }
                  placeholder="MN 12345"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Planes */}
            <div>
              <label className={`${labelClass} flex items-center gap-2 mb-3`}>
                <CreditCard className="h-4 w-4" />
                Plan de suscripción
              </label>
              <div className="grid sm:grid-cols-3 gap-3">
                {PLANS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlan(p.id)}
                    className={`rounded-lg px-4 py-3 text-left border font-medium transition-colors ${
                      plan === p.id
                        ? "border-teal-500 bg-teal-50 text-navy ring-1 ring-teal-400"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{p.name}</span>
                    <span
                      className={`block text-xs mt-0.5 ${
                        plan === p.id ? "text-teal-600" : "text-slate-400"
                      }`}
                    >
                      {p.price} {p.period}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm w-full transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirmar y solicitar habilitación"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-400">
          <a className="underline hover:text-slate-600" href="/">
            Volver al inicio
          </a>
        </p>
      </div>

      {/* Success modal */}
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
              href="/login/medico"
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
