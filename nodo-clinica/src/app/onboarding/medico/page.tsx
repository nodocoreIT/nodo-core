"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope, Loader2, ArrowLeft, CreditCard, Check, CheckCircle } from "lucide-react";
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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-teal-50/40 flex items-center justify-center p-4">
        <Card className="border-red-200 max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-red-600 font-medium">
              Link de onboarding inválido.
            </p>
            <p className="text-slate-500 text-sm mt-2">
              Revisá tu correo electrónico y hacé clic en el link de
              verificación para continuar.
            </p>
            <Link
              href="/registro/medico"
              className="mt-4 inline-block text-teal-600 underline text-sm"
            >
              Volver al registro
            </Link>
          </CardContent>
        </Card>
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-teal-50/40 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>

        <Card className="border-slate-200 shadow-lg mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600">
                {submitted ? (
                  <CheckCircle className="h-5 w-5 text-white" />
                ) : (
                  <Stethoscope className="h-5 w-5 text-white" />
                )}
              </div>
              <div>
                <CardTitle>
                  {submitted ? "Solicitud enviada" : "Completá tu perfil médico"}
                </CardTitle>
                <p className="text-sm text-slate-500">
                  {submitted
                    ? "Estamos revisando tus datos"
                    : "Un último paso para empezar a atender pacientes"}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {submitted ? (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-teal-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  ¡Registro completado!
                </h3>
                <p className="text-slate-600 max-w-sm mx-auto">
                  Pronto desde NODO activaremos tu cuenta. Una vez habilitada,
                  vas a poder iniciar sesión con tu email y contraseña.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="fullName">Nombre completo</Label>
                    <Input
                      id="fullName"
                      required
                      value={form.fullName}
                      onChange={(e) =>
                        setForm({ ...form, fullName: e.target.value })
                      }
                      placeholder="Dr/a. Juan García"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Especialidad</Label>
                    <div className="mt-1">
                      <SpecialtyCombobox
                        value={form.specialty}
                        onChange={(val) => setForm({ ...form, specialty: val })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="licenseNumber">Matrícula (opcional)</Label>
                    <Input
                      id="licenseNumber"
                      value={form.licenseNumber}
                      onChange={(e) =>
                        setForm({ ...form, licenseNumber: e.target.value })
                      }
                      placeholder="MN 12345"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="flex items-center gap-2 mb-3">
                    <CreditCard className="h-4 w-4" />
                    Plan de suscripción
                  </Label>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {PLANS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlan(p.id)}
                        className={`rounded-xl border p-4 text-left transition-all ${
                          plan === p.id
                            ? "border-teal-500 bg-teal-50 ring-2 ring-teal-200"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <p className="font-semibold text-slate-800">{p.name}</p>
                        <p className="text-lg font-bold text-teal-600 mt-1">
                          {p.price}
                          <span className="text-xs font-normal text-slate-400">
                            {" "}
                            {p.period}
                          </span>
                        </p>
                        <ul className="mt-2 space-y-1">
                          {p.features.map((f) => (
                            <li
                              key={f}
                              className="text-xs text-slate-500 flex items-start gap-1"
                            >
                              <Check className="h-3 w-3 text-teal-500 mt-0.5 shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Confirmar y solicitar habilitación"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function OnboardingMedicoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-teal-50/40 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <OnboardingMedicoContent />
    </Suspense>
  );
}
