"use client";

import { useState } from "react";
import {
  useAuth,
  useSupabase,
  enforceNodeAccess,
  mapAuthLoginError,
  fetchMustSetPassword,
  RequiredPasswordForm,
} from "@nodocore/shared-components";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";
import { CLINICA_REGISTRATION_URL } from "@/lib/clinic/platform-config";

interface PlatformMedicoLoginProps {
  email: string;
  password: string;
  loading: boolean;
  setLoading: (v: boolean) => void;
  setGeneralError: (msg: string) => void;
  inputBase: string;
  inputNormal: string;
  inputFocus: string;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
}

export function PlatformMedicoLoginFields({
  email,
  password,
  loading,
  setLoading,
  setGeneralError,
  inputBase,
  inputNormal,
  inputFocus,
  showPassword,
  setShowPassword,
  onEmailChange,
  onPasswordChange,
}: PlatformMedicoLoginProps) {
  const { signInWithPassword } = useAuth();
  const supabase = useSupabase();
  const [needsNewPassword, setNeedsNewPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError("");
    if (!email.trim() || !password) {
      setGeneralError("Completá email y contraseña");
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setGeneralError(mapAuthLoginError(authError.message));
        return;
      }

      const access = await enforceNodeAccess(supabase, "clinica");
      if (!access.ok) {
        setGeneralError(access.message);
        return;
      }

      if (await fetchMustSetPassword(supabase)) {
        setNeedsNewPassword(true);
        return;
      }

      const data = await clinicApi.syncPlatformSession();
      toast.success(`Bienvenido/a, ${data.user.fullName}`);
      window.location.replace("/medico/dashboard");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Error al ingresar con Nodo";
      setGeneralError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (needsNewPassword) {
    return (
      <RequiredPasswordForm
        supabase={supabase}
        onSuccess={async () => {
          const data = await clinicApi.syncPlatformSession();
          toast.success(`Bienvenido/a, ${data.user.fullName}`);
          window.location.replace("/medico/dashboard");
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="text-[13px] text-slate2 mb-4 rounded-md border border-mist bg-white px-3 py-2">
        Accedé con la cuenta que activaste en{" "}
        <a
          href={CLINICA_REGISTRATION_URL}
          className="font-semibold text-brand hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          nodocore.com.ar
        </a>
        .
      </p>

      <div className="mb-4">
        <label
          htmlFor="login-email"
          className="block text-[13px] font-semibold text-navy mb-1.5"
        >
          Correo electrónico
        </label>
        <input
          id="login-email"
          type="email"
          placeholder="tu@email.com"
          autoComplete="username"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          className={`${inputBase} ${inputNormal} ${inputFocus}`}
        />
      </div>

      <div className="mb-5">
        <label
          htmlFor="login-pass"
          className="block text-[13px] font-semibold text-navy mb-1.5"
        >
          Contraseña
        </label>
        <div className="relative">
          <input
            id="login-pass"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className={`${inputBase} ${inputNormal} ${inputFocus} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate2 hover:text-ink cursor-pointer bg-transparent border-none p-1"
          >
            {showPassword ? "Ocultar" : "Ver"}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-md bg-brand text-white font-bold text-[15px] hover:bg-brand-600 disabled:opacity-60 transition-colors"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        Ingresar al consultorio
      </button>
    </form>
  );
}
