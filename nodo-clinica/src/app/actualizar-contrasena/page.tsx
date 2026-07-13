"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ActualizarContrasenaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase puts recovery tokens in the URL hash — the client library
    // detects them automatically and establishes a session.
    const supabase = createClient();
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionReady(true);
      }
    });
    // Also check if there's already a session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => router.push("/medico/dashboard"), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al actualizar contraseña",
      );
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "w-full text-[15px] py-[11px] px-[14px] rounded-md bg-white border transition-all duration-150 outline-none border-slate-200 text-slate-800 focus:border-brand focus:shadow-[0_0_0_4px_rgba(13,148,136,.16)]";

  if (success) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6">
        <div className="w-[min(420px,100%)] flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
            <CheckCircle className="h-7 w-7 text-brand" />
          </div>
          <h2 className="font-display font-bold text-ink text-[24px]">
            Contraseña actualizada
          </h2>
          <p className="text-slate2 text-[14.5px]">
            Redirigiendo al panel…
          </p>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-[min(420px,100%)]">
        <div className="flex items-center gap-1.5 mb-3">
          <KeyRound className="h-3.5 w-3.5 text-brand" />
          <span className="text-[11px] font-bold tracking-widest uppercase text-brand">
            Configurar contraseña
          </span>
        </div>

        <h1 className="font-display font-bold text-ink text-[28px] leading-tight mb-2">
          Creá tu contraseña
        </h1>
        <p className="text-slate2 text-[14.5px] mb-6">
          Elegí una contraseña para acceder a tu cuenta en Nodo Clínica.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label
            htmlFor="new-password"
            className="block text-[13px] font-semibold text-navy mb-1.5"
          >
            Nueva contraseña
          </label>
          <input
            id="new-password"
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputBase} mb-4`}
            required
            minLength={6}
          />

          <label
            htmlFor="confirm-password"
            className="block text-[13px] font-semibold text-navy mb-1.5"
          >
            Confirmar contraseña
          </label>
          <input
            id="confirm-password"
            type="password"
            placeholder="Repetí tu contraseña"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`${inputBase} mb-4`}
            required
          />

          {error && (
            <p className="text-[13px] text-[#C0392B] mb-4 text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-md bg-brand text-white font-semibold text-[15px] hover:bg-brand-600 active:scale-[.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mb-4"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            ) : (
              "Guardar contraseña"
            )}
          </button>

          <p className="text-center">
            <Link
              href="/login"
              className="text-[13px] font-semibold text-brand hover:underline"
            >
              Volver al inicio de sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
