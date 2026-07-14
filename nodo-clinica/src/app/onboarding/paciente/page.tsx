"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ObraSocialCombobox } from "@/components/ui/obra-social-combobox";
import {
  User,
  Loader2,
  CreditCard,
  CheckCircle,
  ImagePlus,
} from "lucide-react";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";

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
const labelClass = "text-xs font-medium text-slate-600";

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
      <label className={labelClass}>{label}</label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-1 w-full rounded-xl border-2 border-dashed border-slate-300 hover:border-teal-400 transition-colors flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-teal-500 overflow-hidden relative aspect-3/2"
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
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs">Subir foto</span>
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

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="rounded-2xl border border-red-200 bg-white p-8 max-w-md w-full text-center shadow-lg">
          <p className="text-red-600 font-medium">Link de onboarding inválido.</p>
          <p className="text-slate-500 text-sm mt-2">
            Revisá tu correo electrónico y hacé clic en el link de verificación para continuar.
          </p>
          <Link
            href="/registro/paciente"
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
    if (!form.fullName) {
      toast.error("El nombre completo es requerido.");
      return;
    }
    if (!form.dni.trim()) {
      toast.error("El número de DNI es requerido.");
      return;
    }
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
              <User className="h-6 w-6" />
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
            Un último paso para empezar a pedir turnos y gestionar tu historial médico.
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
                placeholder="Juan García"
                className={inputClass}
              />
            </div>

            {/* DNI + Dirección */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dni" className={labelClass}>
                  Número de DNI
                </label>
                <input
                  id="dni"
                  required
                  value={form.dni}
                  onChange={(e) => setForm({ ...form, dni: e.target.value })}
                  placeholder="28660386"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="address" className={labelClass}>
                  Dirección (opcional)
                </label>
                <input
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Av. Corrientes 1234, CABA"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Obra social */}
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

            {/* DNI upload */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <DniSlot label="DNI frente" file={dniFront} onChange={setDniFront} />
                <DniSlot label="DNI dorso" file={dniBack} onChange={setDniBack} />
              </div>
              <p className="text-xs text-slate-400">
                Las fotos del DNI son opcionales. Se usan para verificar tu identidad.
              </p>
            </div>

            {/* Planes */}
            <div>
              <label className={`${labelClass} flex items-center gap-2 mb-3`}>
                <CreditCard className="h-4 w-4" />
                Plan
              </label>
              <div className="grid grid-cols-2 gap-3">
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
              href="/login/paciente"
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
