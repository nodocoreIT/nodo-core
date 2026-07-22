"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ObraSocialCombobox } from "@/components/ui/obra-social-combobox";
import { User, Loader2, CheckCircle, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";
import { NeuralNodesBackground } from "@/components/ui/neural-nodes-background";
import { PhoneVerificationField } from "@/components/onboarding/phone-verification-field";

const PLANS = [
  {
    id: "gratuito",
    name: "Gratuito",
    price: "$0",
    period: "siempre",
    features: ["Historial básico", "Videoconsulta"],
  },
  {
    id: "pago",
    name: "Pago",
    price: "$4.900",
    period: "/mes",
    features: ["Historial completo", "Prioridad de atención", "Carga de Estudios"],
  },
];

const inputClass =
  "mt-1 w-full rounded-lg px-3 py-2.5 text-sm bg-white border border-slate-200 text-navy placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 transition-shadow";
const labelClass = "text-xs font-medium text-slate-300";

interface DniSlotProps {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}

function DniSlot({ label, file, onChange }: DniSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = file ? URL.createObjectURL(file) : null;

  return (
    <div className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-1 w-full rounded-xl border-2 border-dashed border-slate-200 hover:border-teal-400 transition-colors flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-teal-500 overflow-hidden relative bg-slate-50"
        style={{ aspectRatio: "3/2" }}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={label}
            className="absolute inset-0 h-full w-full object-contain rounded-xl bg-slate-50"
          />
        ) : (
          <>
            <ImagePlus className="h-7 w-7" />
            <span className="text-xs font-medium">Subir foto</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function OnboardingPacienteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [plan, setPlan] = useState("gratuito");
  const [form, setForm] = useState({
    fullName: "",
    dni: "",
    address: "",
    obraSocial: "",
  });
  const [dniFront, setDniFront] = useState<File | null>(null);
  const [dniBack, setDniBack] = useState<File | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="rounded-2xl border border-red-200 bg-white p-8 max-w-md w-full text-center shadow-lg">
          <p className="text-red-600 font-medium">Link de onboarding inválido.</p>
          <p className="text-slate-500 text-sm mt-2">
            Revisá tu correo y hacé clic en el link de verificación para continuar.
          </p>
          <Link href="/registro/paciente" className="mt-4 inline-block text-teal-600 underline text-sm">
            Volver al registro
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName) { toast.error("El nombre completo es requerido."); return; }
    if (!form.dni.trim()) { toast.error("El número de DNI es requerido."); return; }
    if (!phoneVerified) { toast.error("Verificá tu número de celular antes de continuar."); return; }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("token", token);
      formData.append("fullName", form.fullName);
      formData.append("dni", form.dni.trim());
      if (form.address) formData.append("address", form.address);
      if (form.obraSocial) formData.append("obraSocial", form.obraSocial);
      formData.append("plan", plan);
      if (dniFront) formData.append("dniFront", dniFront);
      if (dniBack) formData.append("dniBack", dniBack);
      await clinicApi.completeOnboardingPaciente(formData);
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
              <User className="h-6 w-6" />
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
            Datos personales y documentación. La contraseña la configurás al primer ingreso, una vez habilitada tu cuenta.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border p-6 md:p-10 shadow-2xl backdrop-blur-md" style={{ background: "rgba(27,42,65,0.88)", borderColor: "rgba(255,255,255,.1)", boxShadow: "0 24px 80px rgba(0,0,0,.35)" }}>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Row 1: Nombre + DNI */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="fullName" className={labelClass}>Nombre completo</label>
                <input
                  id="fullName"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Juan García"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="dni" className={labelClass}>Número de DNI</label>
                <input
                  id="dni"
                  required
                  value={form.dni}
                  onChange={(e) => setForm({ ...form, dni: e.target.value })}
                  placeholder="28660386"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Row 2: Dirección + Obra social */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="address" className={labelClass}>Dirección (opcional)</label>
                <input
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Av. Corrientes 1234, CABA"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Obra social (opcional)</label>
                <div className="mt-1">
                  <ObraSocialCombobox
                    value={form.obraSocial}
                    onChange={(val) => setForm({ ...form, obraSocial: val })}
                    placeholder="Buscar obra social..."
                  />
                </div>
              </div>
            </div>

            <PhoneVerificationField
              onboardingToken={token}
              labelClass={labelClass}
              onVerifiedChange={setPhoneVerified}
            />

            {/* Row 3: DNI upload + Plan side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* DNI upload */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Documento de identidad</p>
                <div className="grid grid-cols-2 gap-3">
                  <DniSlot label="DNI frente" file={dniFront} onChange={setDniFront} />
                  <DniSlot label="DNI dorso" file={dniBack} onChange={setDniBack} />
                </div>
                <p className="text-xs" style={{ color: "rgba(234,240,247,.4)" }}>Las fotos son opcionales. Se usan para verificar tu identidad.</p>
              </div>

              {/* Plan */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Plan</p>
                <div className="space-y-3">
                  {PLANS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlan(p.id)}
                      className={`w-full rounded-lg px-4 py-3 text-left border font-medium transition-all ${
                        plan === p.id
                          ? "border-teal-500 bg-white text-navy ring-1 ring-teal-400 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-teal-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{p.name}</span>
                        <span className={`text-sm font-bold ${plan === p.id ? "text-teal-600" : "text-slate-500"}`}>
                          {p.price} <span className="text-xs font-normal">{p.period}</span>
                        </span>
                      </div>
                      <ul className="mt-1.5 space-y-0.5">
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
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !phoneVerified}
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

export default function OnboardingPacientePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <OnboardingPacienteContent />
    </Suspense>
  );
}
