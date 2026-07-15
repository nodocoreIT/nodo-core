"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, MailCheck } from "lucide-react";
export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/clinic/account/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al enviar el correo");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar el correo");
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "w-full text-[15px] py-[11px] px-[14px] rounded-md bg-white border transition-all duration-150 outline-none border-slate-200 text-slate-800 focus:border-brand focus:shadow-[0_0_0_4px_rgba(13,148,136,.16)]";

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-[min(420px,100%)]">
        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
              <MailCheck className="h-7 w-7 text-brand" />
            </div>
            <h2 className="font-display font-bold text-ink text-[24px]">
              Revisá tu correo
            </h2>
            <p className="text-slate2 text-[14.5px] max-w-xs">
              Te enviamos un enlace de recuperación a{" "}
              <span className="font-semibold text-ink">{email}</span>.
            </p>
            <Link
              href="/login"
              className="mt-2 text-[13px] font-semibold text-brand hover:underline"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 mb-3">
              <KeyRound className="h-3.5 w-3.5 text-brand" />
              <span className="text-[11px] font-bold tracking-widest uppercase text-brand">
                Recuperar contraseña
              </span>
            </div>

            <h1 className="font-display font-bold text-ink text-[28px] leading-tight mb-2">
              ¿Olvidaste tu contraseña?
            </h1>
            <p className="text-slate2 text-[14.5px] mb-6">
              Ingresá tu correo electrónico para recibir un enlace de
              recuperación.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <label
                htmlFor="recovery-email"
                className="block text-[13px] font-semibold text-navy mb-1.5"
              >
                Correo electrónico
              </label>
              <input
                id="recovery-email"
                type="email"
                placeholder="ejemplo@nodocore.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                  "Recuperar ingreso"
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
          </>
        )}
      </div>
    </div>
  );
}
