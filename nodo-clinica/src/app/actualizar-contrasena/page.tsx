"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Loader2, CheckCircle, Stethoscope } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clinicApi } from "@/lib/clinic/client-api";

export default function ActualizarContrasenaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // @supabase/ssr's createBrowserClient does NOT auto-process URL hash tokens
    // (it's built for PKCE/code flow). Parse the hash manually and call setSession.
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash) {
      const params = new URLSearchParams(hash.slice(1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
          if (!error) {
            setUserEmail(data.session?.user?.email ?? null);
            setSessionReady(true);
          }
        });
        return;
      }
    }

    // Fallback: check for an existing session (e.g. user refreshes the page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserEmail(session.user?.email ?? null);
        setSessionReady(true);
      }
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
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // 1. Set app_metadata.role BEFORE re-login so the JWT includes the role claim.
      //    This endpoint uses the service role key — no session required (recovery is
      //    already consumed by updateUser above).
      let redirectPath = "/medico/dashboard";
      let loginRole: "doctor" | "patient" = "doctor";
      if (userEmail) {
        const roleRes = await fetch("/api/clinic/account/ensure-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: userEmail }),
        });
        const roleData = await roleRes.json().catch(() => ({}));
        if (roleData.role === "paciente") {
          redirectPath = "/paciente";
          loginRole = "patient";
        }
      }

      // 2. Re-authenticate — the new JWT will have app_metadata.role set from step 1.
      if (userEmail) {
        await clinicApi.login(userEmail, password, loginRole);
      }

      setSuccess(true);
      setTimeout(() => window.location.replace(redirectPath), 2000);
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

  const brandPanel = (
    <aside className="login-brand-panel relative overflow-hidden bg-navy-900 text-white p-12 flex-col justify-between hidden">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(72% 58% at 38% 42%, rgba(13,148,136,.22), transparent 72%)",
        }}
      />
      <div className="relative z-[1]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/logo compuesto estrella az letra blancazzz.png"
          alt="NODO Clínica"
          style={{ height: "30px", width: "auto" }}
        />
      </div>
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col items-center justify-center py-8">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: "rgba(13,148,136,0.15)",
              border: "1px solid rgba(13,148,136,0.35)",
              color: "#0D9488",
            }}
          >
            <Stethoscope aria-hidden className="h-7 w-7" strokeWidth={1.75} />
          </span>
          <div className="flex items-center gap-[0.4em] flex-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/nodo ver clinica.png"
              alt="NODO"
              className="inline-block shrink-0"
              style={{ height: "clamp(30px,3vw,40px)", width: "auto" }}
            />
            <span
              aria-hidden
              className="font-light leading-none text-white/30"
              style={{ fontSize: "clamp(30px,3vw,40px)" }}
            >
              |
            </span>
            <span
              className="font-display font-extrabold text-white"
              style={{ fontSize: "clamp(30px,3vw,40px)", lineHeight: 1.1 }}
            >
              Clínica
            </span>
          </div>
        </div>
      </div>
      <div className="relative z-[1] border-t border-white/10 pt-8">
        <p
          className="max-w-[34em] text-[14.5px] leading-relaxed"
          style={{ color: "rgba(234,240,247,.72)" }}
        >
          Telemedicina profesional: agenda, videoconsultas, historial clínico
          e informes con IA para médicos y pacientes.
        </p>
        <p className="mt-8 text-[13px]" style={{ color: "rgba(234,240,247,.48)" }}>
          © 2026 Nodo Core · Transparencia tecnológica
        </p>
      </div>
    </aside>
  );

  if (success) {
    return (
      <div className="min-h-screen grid grid-cols-1 login-split">
        {brandPanel}
        <main className="flex items-center justify-center p-8 bg-paper min-h-screen">
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
        </main>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen grid grid-cols-1 login-split">
        {brandPanel}
        <main className="flex items-center justify-center p-8 bg-paper min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-1 login-split">
      {brandPanel}
      <main className="flex items-center justify-center p-8 bg-paper min-h-screen">
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
      </main>
    </div>
  );
}
