"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { completeForcedPassword } from "../lib/jwt-claims";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Eye, EyeOff } from "lucide-react";

export interface RequiredPasswordFormProps {
  supabase: SupabaseClient;
  title?: string;
  description?: string;
  submitLabel?: string;
  landingApiBaseUrl?: string;
  onSuccess: () => void;
  header?: ReactNode;
}

export function RequiredPasswordForm({
  supabase,
  title = "Definí tu nueva contraseña",
  description = "Tu acceso fue blanqueado o requiere una clave nueva. Elegí una contraseña y repetila para continuar.",
  submitLabel = "Continuar",
  landingApiBaseUrl,
  onSuccess,
  header,
}: RequiredPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await completeForcedPassword({
      supabase,
      password: password.trim(),
      confirmPassword: confirmPassword.trim(),
      landingApiBaseUrl,
    });

    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSuccess();
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      {header ?? (
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold text-navy">{title}</h1>
          <p className="text-sm text-slate2">{description}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="required-password">Contraseña</Label>
          <div className="relative">
            <Input
              id="required-password"
              type={showPassword ? "text" : "password"}
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 bg-transparent border-none p-0 cursor-pointer"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="required-password-confirm">Repetir contraseña</Label>
          <div className="relative">
            <Input
              id="required-password-confirm"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 bg-transparent border-none p-0 cursor-pointer"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && <p className="text-xs font-medium text-destructive">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Guardando…" : submitLabel}
        </Button>
      </form>
    </div>
  );
}
