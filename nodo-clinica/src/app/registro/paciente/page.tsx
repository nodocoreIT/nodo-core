"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";

export default function RegistroPacientePage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await clinicApi.register({ email, role: "paciente" });
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-teal-50/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
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
                <CardTitle>Registro de Paciente</CardTitle>
                <p className="text-sm text-slate-500">
                  Creá tu cuenta para pedir turnos online
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {submitted ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
                  <MailCheck className="h-7 w-7 text-teal-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">
                  Revisá tu correo
                </h3>
                <p className="text-sm text-slate-500 max-w-xs">
                  Te enviamos un enlace de verificación a{" "}
                  <span className="font-medium text-slate-700">{email}</span>.
                  Hacé clic en el enlace para continuar con tu registro.
                </p>
                <p className="text-xs text-slate-400">
                  El enlace vence en 24 horas.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@ejemplo.com"
                    className="mt-1"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Continuar"
                  )}
                </Button>

                <p className="text-sm text-center text-slate-500">
                  ¿Ya tenés cuenta?{" "}
                  <Link
                    href="/login/paciente"
                    className="text-teal-600 hover:underline"
                  >
                    Ingresar
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
