"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope, Loader2, ArrowLeft, CreditCard, Check } from "lucide-react";
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

export default function RegistroMedicoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState("trial");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    specialty: "Medicina General",
    licenseNumber: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await clinicApi.register({
        role: "doctor",
        ...form,
        plan,
      });
      toast.success("¡Registro exitoso! Bienvenido a la clínica.");
      window.location.href = "/medico/dashboard";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50/40 py-8 px-4">
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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-700">
                <Stethoscope className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle>Registro de Médico</CardTitle>
                <p className="text-sm text-slate-500">
                  Unite a la clínica virtual y atendé pacientes online
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label>Nombre completo</Label>
                  <Input
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
                  <Label>Email profesional</Label>
                  <Input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Contraseña</Label>
                  <Input
                    type="password"
                    required
                    minLength={6}
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Especialidad</Label>
                  <div className="mt-1">
                    <SpecialtyCombobox
                      value={form.specialty}
                      onChange={(val) =>
                        setForm({ ...form, specialty: val })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Matrícula</Label>
                  <Input
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
                          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <p className="font-semibold text-slate-800">{p.name}</p>
                      <p className="text-lg font-bold text-blue-700 mt-1">
                        {p.price}
                        <span className="text-xs font-normal text-slate-400">
                          {p.period}
                        </span>
                      </p>
                      <ul className="mt-2 space-y-1">
                        {p.features.map((f) => (
                          <li
                            key={f}
                            className="text-xs text-slate-500 flex items-start gap-1"
                          >
                            <Check className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Modo local: la suscripción se activa automáticamente sin pago real.
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-700 hover:bg-blue-800"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Crear cuenta y activar plan"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
