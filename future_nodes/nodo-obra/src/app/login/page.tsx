"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { obraApi } from "@/lib/obra/client-api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("direccion@nodo.demo");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await obraApi.login(email, password);
      router.replace("/obras");
    } catch {
      setError("No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-4">
      <div className="w-full max-w-md rounded-md border border-mist bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-900">
            <HardHat className="h-5 w-5 text-brand" />
          </div>
          <div>
            <p className="font-display font-bold text-navy text-lg leading-tight">
              nodo<span className="text-brand">obra</span>
            </p>
            <p className="text-xs text-slate2">Acceso staff</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="demo1234"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>
        <p className="text-xs text-slate2 mt-4 text-center">
          <Link href="/cliente/login" className="text-brand hover:underline">
            Portal cliente
          </Link>
          {" · "}
          <Link href="/" className="text-brand hover:underline">
            Inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
