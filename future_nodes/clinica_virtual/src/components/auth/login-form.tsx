"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope, User, Loader2, ArrowLeft, Wifi } from "lucide-react";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";
import { DEMO_CREDENTIALS } from "@/lib/clinic/config";

interface LoginFormProps {
  defaultRole: "doctor" | "patient";
  title?: string;
  subtitle?: string;
}

export function LoginForm({
  defaultRole,
  title,
  subtitle,
}: LoginFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const demo =
    defaultRole === "doctor"
      ? DEMO_CREDENTIALS.doctor
      : DEMO_CREDENTIALS.patient;
  const [form, setForm] = useState(demo);

  const handleLogin = async () => {
    setError(null);
    if (!form.email.trim() || !form.password) {
      setError("Completá email y contraseña");
      return;
    }

    setLoading(true);
    try {
      const data = await clinicApi.login(
        form.email.trim(),
        form.password,
        defaultRole
      );
      toast.success(`Bienvenido/a, ${data.user.fullName}`);
      window.location.href =
        defaultRole === "doctor" ? "/medico/dashboard" : "/paciente";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al ingresar";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const isDoctor = defaultRole === "doctor";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="text-center">
            <div
              className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl mb-2 ${
                isDoctor ? "bg-blue-700" : "bg-emerald-600"
              }`}
            >
              {isDoctor ? (
                <Stethoscope className="h-6 w-6 text-white" />
              ) : (
                <User className="h-6 w-6 text-white" />
              )}
            </div>
            <CardTitle>
              {title ?? (isDoctor ? "Consultorio Médico" : "Portal del Paciente")}
            </CardTitle>
            <p className="text-sm text-slate-500">
              {subtitle ??
                (isDoctor
                  ? "Accedé a tu panel de consultas"
                  : "Pedí turno y entrá a la sala de espera")}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800 flex gap-2">
              <Wifi className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Desde otra PC o celular usá la IP de la PC servidor, por ejemplo{" "}
                <strong>http://192.168.x.x:3000</strong> (no uses localhost).
              </span>
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1"
                autoComplete="email"
              />
            </div>
            <div>
              <Label>Contraseña</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="mt-1"
                autoComplete="current-password"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="button"
              className={`w-full ${isDoctor ? "bg-blue-700 hover:bg-blue-800" : "bg-emerald-600 hover:bg-emerald-700"}`}
              disabled={loading}
              onClick={handleLogin}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isDoctor ? (
                "Ingresar al consultorio"
              ) : (
                "Ingresar"
              )}
            </Button>

            <p className="text-xs text-center text-slate-400">
              Demo: {demo.email} / {demo.password}
            </p>
            <div className="pt-4 border-t text-center text-sm text-slate-500">
              ¿No tenés cuenta?{" "}
              <Link
                href={isDoctor ? "/registro/medico" : "/registro/paciente"}
                className="text-blue-700 hover:underline"
              >
                Registrarse
              </Link>
              {" · "}
              <Link
                href={isDoctor ? "/login/paciente" : "/login/medico"}
                className="text-slate-600 hover:underline"
              >
                Soy {isDoctor ? "paciente" : "médico"}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
