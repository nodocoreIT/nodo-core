"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Loader2,
  ArrowLeft,
  CreditCard,
  Check,
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
    features: ["Hasta 3 turnos/mes", "Historial básico", "Videoconsulta"],
  },
  {
    id: "pago",
    name: "Pago",
    price: "$4.900",
    period: "/mes",
    features: ["Turnos ilimitados", "Historial completo", "Prioridad de atención"],
  },
];

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
      <Label>{label}</Label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-1 h-28 w-full rounded-xl border-2 border-dashed border-slate-300 hover:border-teal-400 transition-colors flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-teal-500 overflow-hidden relative"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={label}
            className="absolute inset-0 h-full w-full object-cover rounded-xl"
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

export default function OnboardingPacientePage() {
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState("gratuito");
  const [form, setForm] = useState({
    fullName: "",
    address: "",
    obraSocial: "",
  });
  const [dniFront, setDniFront] = useState<File | null>(null);
  const [dniBack, setDniBack] = useState<File | null>(null);

  // Auth guard: redirect to login if no active session
  useEffect(() => {
    clinicApi
      .getSession()
      .then((data) => {
        if (!data?.session?.userId && !data?.user?.id) {
          router.push("/login/paciente");
        } else {
          setSessionChecked(true);
        }
      })
      .catch(() => {
        router.push("/login/paciente");
      });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName) {
      toast.error("El nombre completo es requerido.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("fullName", form.fullName);
      if (form.address) formData.append("address", form.address);
      if (form.obraSocial) formData.append("obraSocial", form.obraSocial);
      formData.append("plan", plan);
      if (dniFront) formData.append("dniFront", dniFront);
      if (dniBack) formData.append("dniBack", dniBack);

      await clinicApi.completeOnboardingPaciente(formData);
      window.location.href = "/paciente";
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al completar el registro",
      );
    } finally {
      setLoading(false);
    }
  };

  // Show loading skeleton while session check is in flight
  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-teal-50/40 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-teal-50/40 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle>Completá tu perfil</CardTitle>
                <p className="text-sm text-slate-500">
                  Un último paso para empezar a pedir turnos
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input
                  id="fullName"
                  required
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                  placeholder="Juan García"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="address">Dirección (opcional)</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="Av. Corrientes 1234, CABA"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="obraSocial">Obra social (opcional)</Label>
                <Input
                  id="obraSocial"
                  value={form.obraSocial}
                  onChange={(e) =>
                    setForm({ ...form, obraSocial: e.target.value })
                  }
                  placeholder="OSDE, IOMA, particular..."
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <DniSlot
                  label="DNI frente"
                  file={dniFront}
                  onChange={setDniFront}
                />
                <DniSlot
                  label="DNI dorso"
                  file={dniBack}
                  onChange={setDniBack}
                />
              </div>
              <p className="text-xs text-slate-400">
                Las fotos del DNI son opcionales. Se usan para verificar tu
                identidad.
              </p>

              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-4 w-4" />
                  Plan
                </Label>
                <div className="grid grid-cols-2 gap-3">
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
                          {" "}{p.period}
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
                  "Completar registro"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
