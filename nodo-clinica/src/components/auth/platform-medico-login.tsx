"use client";

import { useState } from "react";
import {
  enforceNodeAccess,
  mapAuthLoginError,
  fetchMustSetPassword,
  RequiredPasswordForm,
  PAUSED_NODE_MESSAGE,
  clearSessionClock,
} from "@nodocore/shared-components";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  CLINICA_REGISTRATION_URL,
  CLINICA_AUTH_CONFIG,
  CLINICA_SESSION_STORAGE_KEY_PREFIX,
  NODO_LANDING_URL,
} from "@/lib/clinic/platform-config";

interface PlatformMedicoLoginProps {
  email: string;
  password: string;
  loading: boolean;
  setLoading: (v: boolean) => void;
  generalError: string;
  setGeneralError: (msg: string) => void;
  inputBase: string;
  inputNormal: string;
  inputFocus: string;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onForgotPassword?: () => void;
  onSuccess?: () => void;
}

export function PlatformMedicoLoginFields({
  email,
  password,
  loading,
  setLoading,
  generalError,
  setGeneralError,
  inputBase,
  inputNormal,
  inputFocus,
  showPassword,
  setShowPassword,
  onEmailChange,
  onPasswordChange,
  onForgotPassword,
  onSuccess,
}: PlatformMedicoLoginProps) {
  const supabase = getSupabaseBrowserClient();
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [pausedModal, setPausedModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError("");
    if (!email.trim() || !password) {
      setGeneralError("Completá email y contraseña");
      return;
    }

    setLoading(true);
    try {
      const eligibilityRes = await fetch("/api/clinic/account/portal-eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role: "medico" }),
      });
      if (!eligibilityRes.ok) {
        const eligibilityData = await eligibilityRes.json().catch(() => ({}));
        setGeneralError(
          eligibilityData.error ?? "No existe un médico registrado con ese correo.",
        );
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setGeneralError(mapAuthLoginError(authError.message));
        return;
      }

      const access = await enforceNodeAccess(
        supabase,
        CLINICA_AUTH_CONFIG.unitCode,
        CLINICA_AUTH_CONFIG.sessionStorageKeyPrefix,
      );
      if (!access.ok) {
        if (access.reason === "paused") {
          setPausedModal(true);
          void fetch(`${NODO_LANDING_URL}/api/node-access/paused-notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: email.trim(),
              unitCode: CLINICA_AUTH_CONFIG.unitCode,
              nodeLabel: "Nodo Clínica",
            }),
          }).catch(() => undefined);
        } else {
          setGeneralError(access.message);
        }
        return;
      }

      const verifyRes = await fetch("/api/clinic/account/verify-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: "medico" }),
      });
      if (!verifyRes.ok) {
        await supabase.auth.signOut({ scope: "local" });
        clearSessionClock(CLINICA_SESSION_STORAGE_KEY_PREFIX);
        const verifyData = await verifyRes.json().catch(() => ({}));
        setGeneralError(
          verifyData.error ?? "No existe un médico registrado con ese correo.",
        );
        return;
      }

      if (await fetchMustSetPassword(supabase)) {
        setNeedsNewPassword(true);
        return;
      }

      if (onSuccess) {
        onSuccess();
        await new Promise((r) => setTimeout(r, 1500));
      }
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
          window.location.replace("/medico/dashboard");
        }}
      />
    );
  }

  return (
    <>
    <form onSubmit={handleSubmit} noValidate>
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

      <div className="mb-4">
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
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {onForgotPassword && (
        <div className="flex justify-end mb-5">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-[13px] font-semibold text-brand hover:underline bg-transparent border-none cursor-pointer p-0"
          >
            ¿Olvidó su contraseña?
          </button>
        </div>
      )}

      {generalError && (
        <p className="text-[13px] text-[#C0392B] mb-3 text-center">{generalError}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-md bg-brand text-white font-bold text-[15px] hover:bg-brand-600 disabled:opacity-60 transition-colors"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        Ingresar al consultorio
      </button>
    </form>
    {pausedModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-7 text-center shadow-xl">
          <h3 className="mb-2 text-xl font-extrabold text-navy">Nodo pausado</h3>
          <p className="mb-2 text-sm leading-relaxed text-slate2">{PAUSED_NODE_MESSAGE}</p>
          <p className="mb-6 text-xs leading-relaxed text-slate2">
            Ya avisamos a NODO Core. También podés escribir a{" "}
            <a
              href="mailto:contacto@nodocore.com.ar"
              className="font-semibold text-brand underline-offset-2 hover:underline"
            >
              contacto@nodocore.com.ar
            </a>
            .
          </p>
          <button
            type="button"
            className="w-full rounded-md bg-brand py-3 text-[15px] font-bold text-white hover:bg-brand-600"
            onClick={() => setPausedModal(false)}
          >
            Entendido
          </button>
        </div>
      </div>
    )}
    </>
  );
}
