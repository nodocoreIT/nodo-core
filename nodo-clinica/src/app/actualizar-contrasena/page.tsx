"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Loader2, CheckCircle, Stethoscope, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clinicApi } from "@/lib/clinic/client-api";
import { CLINIC_BRAND_LOGO_SRC } from "@/lib/clinic/brand";
import { parseClinicDbRole } from "@/lib/clinic/resolve-clinic-role";

export default function ActualizarContrasenaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [intendedRole, setIntendedRole] = useState<"medico" | "paciente">("paciente");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function initSession() {
      const searchParams = new URLSearchParams(window.location.search);
      const roleFromUrl = parseClinicDbRole(searchParams.get("role"));
      if (roleFromUrl) setIntendedRole(roleFromUrl);

      // Link expired — callback route forwarded this error
      if (searchParams.get("error") === "link_expired") {
        setError("El enlace de recuperación expiró o ya fue usado. Solicitá uno nuevo.");
        setSessionReady(true);
        return;
      }

      // 1. Normal path: /auth/callback already exchanged the code server-side
      //    and set the session in cookies. getSession() reads those cookies.
      //    Re-call setSession() to force the token into the client's memory so
      //    that updateUser() doesn't throw "Auth session missing!".
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && session?.refresh_token) {
        const { data: refreshed } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        if (refreshed.session) {
          setUserEmail(refreshed.session.user?.email ?? null);
          setAuthUserId(refreshed.session.user?.id ?? null);
          const metaRole = parseClinicDbRole(
            refreshed.session.user?.app_metadata?.role as string | undefined,
          );
          if (metaRole && !roleFromUrl) setIntendedRole(metaRole);
          setSessionReady(true);
          return;
        }
      }

      // 2. Fallback: implicit flow — #access_token=...&refresh_token=... in hash
      //    (older Supabase projects or direct token links)
      const hash = window.location.hash;
      if (hash) {
        const hashParams = new URLSearchParams(hash.slice(1));
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");
        if (access_token && refresh_token) {
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error && data.session) {
            setUserEmail(data.session.user?.email ?? null);
            setAuthUserId(data.session.user?.id ?? null);
            const metaRole = parseClinicDbRole(
              data.session.user?.app_metadata?.role as string | undefined,
            );
            if (metaRole && !roleFromUrl) setIntendedRole(metaRole);
            setSessionReady(true);
            const roleParam = roleFromUrl ?? metaRole ?? "paciente";
            window.history.replaceState(
              {},
              "",
              `${window.location.pathname}?role=${roleParam}`,
            );
            return;
          }
        }
      }

      // Nothing worked
      setError("El enlace de recuperación expiró o ya fue usado. Solicitá uno nuevo.");
      setSessionReady(true);
    }

    void initSession();
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
      const passwordAlreadySet =
        updateError?.message ===
          "New password should be different from the old password." ||
        (updateError as { code?: string } | null)?.code === "same_password";
      if (updateError && !passwordAlreadySet) throw updateError;

      let redirectPath = intendedRole === "medico" ? "/medico/dashboard" : "/paciente";
      let loginRole: "doctor" | "patient" =
        intendedRole === "medico" ? "doctor" : "patient";
      if (userEmail || authUserId) {
        const roleRes = await fetch("/api/clinic/account/ensure-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: userEmail ?? undefined,
            userId: authUserId ?? undefined,
            intendedRole,
          }),
        });
        const roleData = await roleRes.json().catch(() => ({}));
        if (!roleRes.ok || !roleData.role) {
          throw new Error(
            roleData.error ??
              "No se pudo verificar el tipo de cuenta. Solicitá un nuevo enlace.",
          );
        }
        if (roleData.role === "medico") {
          redirectPath = "/medico/dashboard";
          loginRole = "doctor";
        } else {
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
      const msg = err instanceof Error ? err.message : "";
      const SUPABASE_ERRORS: Record<string, string> = {
        "Auth session missing!": "La sesión expiró. Solicitá un nuevo enlace de recuperación.",
        "Password should be at least 6 characters.": "La contraseña debe tener al menos 6 caracteres.",
        "New password should be different from the old password.": "La nueva contraseña debe ser diferente a la anterior.",
        "User not found": "Usuario no encontrado.",
        "Invalid login credentials": "Credenciales incorrectas.",
      };
      setError((SUPABASE_ERRORS[msg] ?? msg) || "Error al actualizar contraseña");
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
          src={CLINIC_BRAND_LOGO_SRC}
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
              src={CLINIC_BRAND_LOGO_SRC}
              alt="NODO Clínica"
              className="inline-block shrink-0"
              style={{ height: "clamp(30px,3vw,40px)", width: "auto" }}
            />
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
            <div className="relative mb-4">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputBase} pr-12`}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 bg-transparent border-none p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <label
              htmlFor="confirm-password"
              className="block text-[13px] font-semibold text-navy mb-1.5"
            >
              Confirmar contraseña
            </label>
            <div className="relative mb-4">
              <input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                placeholder="Repetí tu contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={`${inputBase} pr-12`}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 bg-transparent border-none p-1 cursor-pointer"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

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
