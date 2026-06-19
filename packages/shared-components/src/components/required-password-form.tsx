"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { completeForcedPassword } from "../lib/jwt-claims";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

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
          <Input
            id="required-password"
            type="password"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="required-password-confirm">Repetir contraseña</Label>
          <Input
            id="required-password-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-xs font-medium text-destructive">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Guardando…" : submitLabel}
        </Button>
      </form>
    </div>
  );
}
