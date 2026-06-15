"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";

export default function RegistroPacientePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await clinicApi.register({ role: "patient", ...form });
      toast.success("¡Cuenta creada! Ya podés pedir turno.");
      window.location.href = "/paciente";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50/40 flex items-center justify-center p-4">
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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600">
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Nombre completo</Label>
                <Input
                  required
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Email</Label>
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
                <Label>Teléfono (opcional)</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  placeholder="11 5555-0000"
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
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Crear cuenta"
                )}
              </Button>
            </form>
            <p className="text-sm text-center text-slate-500 mt-4">
              ¿Ya tenés cuenta?{" "}
              <Link href="/login/paciente" className="text-blue-700 hover:underline">
                Ingresar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
