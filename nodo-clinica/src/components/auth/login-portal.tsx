"use client";

import { useState } from "react";
import Link from "next/link";
import { Stethoscope, User, Eye, EyeOff, Loader2, KeyRound, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function NodeTransitionOverlay({ isDoctor }: { isDoctor: boolean }) {
  return (
    <>
      <style>{`
        @keyframes nodo-ping {
          75%, to { transform: scale(1.7); opacity: 0; }
        }
        @keyframes nodo-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: .3; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes nodo-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          backgroundColor: "#0f172a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(60% 50% at 50% 50%, rgba(13,148,136,.20), transparent 70%)",
          }}
        />

        {/* Icon with ping rings */}
        <div style={{ position: "relative", width: 64, height: 64 }}>
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              backgroundColor: "rgba(13,148,136,.25)",
              animation: "nodo-ping 1.4s cubic-bezier(0,0,.2,1) infinite",
            }}
          />
          <span
            style={{
              position: "absolute",
              inset: "6px",
              borderRadius: "50%",
              backgroundColor: "rgba(13,148,136,.15)",
              animation: "nodo-ping 1.4s cubic-bezier(0,0,.2,1) .3s infinite",
            }}
          />
          <span
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: "50%",
              backgroundColor: "rgba(13,148,136,.18)",
              border: "1px solid rgba(13,148,136,.4)",
              color: "#0D9488",
            }}
          >
            <Stethoscope style={{ width: 28, height: 28 }} strokeWidth={1.75} />
          </span>
        </div>

        {/* Label + lockup */}
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(234,240,247,.45)",
              marginBottom: 10,
            }}
          >
            ENTRANDO A
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.35em",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display, sans-serif)",
                fontSize: 34,
                fontWeight: 800,
                color: "#0D9488",
                letterSpacing: "-0.02em",
              }}
            >
              NODO
            </span>
            <span
              style={{
                fontSize: 34,
                fontWeight: 300,
                color: "rgba(234,240,247,.35)",
                lineHeight: 1,
              }}
            >
              |
            </span>
            <span
              style={{
                fontFamily: "var(--font-display, sans-serif)",
                fontSize: 34,
                fontWeight: 800,
                color: "#ffffff",
              }}
            >
              {isDoctor ? "Clínica" : "Portal"}
            </span>
          </div>
        </div>

        {/* Dots */}
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: "#0D9488",
                animation: `nodo-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: "rgba(13,148,136,.15)",
          }}
        >
          <div
            style={{
              height: "100%",
              backgroundColor: "#0D9488",
              animation: "nodo-progress 1.4s ease-out forwards",
            }}
          />
        </div>
      </div>
    </>
  );
}
import { clinicApi } from "@/lib/clinic/client-api";
import {
  CLINICA_REGISTRATION_URL,
  isOpenRegistrationAllowed,
  isPlatformMode,
} from "@/lib/clinic/platform-config";
import { PlatformMedicoLoginFields } from "@/components/auth/platform-medico-login";

type Role = "doctor" | "patient";
type AuthMode = "login" | "register" | "forgot";

export function LoginPortal() {
  const [role, setRole] = useState<Role>("doctor");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [showTransition, setShowTransition] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);

  const isDoctor = role === "doctor";
  const platformDoctor = isDoctor && isPlatformMode();
  const showRegister = isOpenRegistrationAllowed() && !platformDoctor;

  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    setGeneralError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError("");
    if (!form.email.trim() || !form.password) {
      setGeneralError("Completá email y contraseña");
      return;
    }
    setLoading(true);
    try {
      await clinicApi.login(form.email.trim(), form.password, role);
      setShowTransition(true);
      setTimeout(() => {
        window.location.replace(isDoctor ? "/medico/dashboard" : "/paciente");
      }, 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al ingresar";
      setGeneralError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError("");
    if (!form.fullName.trim() || !form.email.trim()) {
      setGeneralError("Completá todos los campos obligatorios");
      return;
    }
    setLoading(true);
    try {
      await clinicApi.register({
        email: form.email.trim(),
        role: isDoctor ? "medico" : "paciente",
      });
      setRegisterSuccess(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al registrarse";
      setGeneralError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError("");
    if (!recoveryEmail.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/clinic/account/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recoveryEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al enviar el correo");
      setRecoverySent(true);
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "Error al enviar el correo");
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "w-full text-[15px] py-[11px] px-[14px] rounded-md bg-white border transition-all duration-150 outline-none";
  const inputNormal = "border-mist text-ink";
  const inputFocus =
    "focus:border-brand focus:shadow-[0_0_0_4px_rgba(13,148,136,.16)]";

  return (
    <>
      {showTransition && <NodeTransitionOverlay isDoctor={isDoctor} />}

      <a
        href="https://www.nodocore.com.ar/nodo-clinica"
        className="fixed top-[22px] right-[22px] z-10 inline-flex items-center gap-2 px-4 py-2 text-[14px] font-semibold rounded-md bg-brand text-white shadow-sm hover:bg-brand-600 active:scale-[.98] transition-all duration-150"
      >
        ← Volver a la web
      </a>

      <div className="min-h-screen grid grid-cols-1 login-split">
        {/* ── Left branding panel ── */}
        <aside className="login-brand-panel relative overflow-hidden bg-navy-900 text-white p-12 flex-col justify-between hidden">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(72% 58% at 38% 42%, rgba(13,148,136,.22), transparent 72%)",
            }}
          />

          {/* Top logo */}
          <div className="relative z-[1]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/logo compuesto estrella az letra blancazzz.png"
              alt="NODO Clínica"
              style={{ height: "30px", width: "auto" }}
            />
          </div>

          {/* Center lockup — flex-1 vertically centered */}
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

          {/* Bottom description */}
          <div className="relative z-[1] border-t border-white/10 pt-8">
            <p
              className="max-w-[34em] text-[14.5px] leading-relaxed"
              style={{ color: "rgba(234,240,247,.72)" }}
            >
              Telemedicina profesional: agenda, videoconsultas, historial clínico
              e informes con IA para médicos y pacientes.
            </p>
            <p
              className="mt-8 text-[13px]"
              style={{ color: "rgba(234,240,247,.48)" }}
            >
              © 2026 Nodo Core · Transparencia tecnológica
            </p>
          </div>
        </aside>

        {/* ── Right form panel ── */}
        <main className="flex items-center justify-center p-8 bg-paper min-h-screen">
          <div className="w-[min(420px,100%)]">

            {/* Register success — inline panel, no modal */}
            {registerSuccess && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
                  <MailCheck className="h-8 w-8 text-brand" />
                </div>
                <h2 className="font-display font-bold text-ink text-[24px]">¡Activá tu cuenta!</h2>
                <p className="text-slate2 text-[14.5px] max-w-xs">
                  Te enviamos un correo de verificación. Revisá tu casilla para continuar con el registro.
                </p>
                <button
                  type="button"
                  onClick={() => { setRegisterSuccess(false); setAuthMode("login"); }}
                  className="text-[13px] font-semibold text-brand hover:underline bg-transparent border-none cursor-pointer p-0 mt-2"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            )}

            {/* Tabs */}
            {!registerSuccess && authMode !== "forgot" && <div className="flex border-b border-mist mb-6">
              <button
                type="button"
                onClick={() => { setAuthMode("login"); setGeneralError(""); }}
                className={`flex-1 pb-3 text-[15px] font-bold transition-colors border-b-2 ${
                  authMode === "login"
                    ? "border-brand text-brand"
                    : "border-transparent text-slate2 hover:text-navy"
                }`}
              >
                Iniciar sesión
              </button>
              {showRegister ? (
                <button
                  type="button"
                  onClick={() => { setAuthMode("register"); setGeneralError(""); }}
                  className={`flex-1 pb-3 text-[15px] font-bold transition-colors border-b-2 ${
                    authMode === "register"
                      ? "border-brand text-brand"
                      : "border-transparent text-slate2 hover:text-navy"
                  }`}
                >
                  Registrarse
                </button>
              ) : platformDoctor ? (
                <a
                  href={CLINICA_REGISTRATION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 pb-3 text-center text-[15px] font-bold text-slate2 hover:text-brand transition-colors"
                >
                  Suscribirme
                </a>
              ) : null}
            </div>}

            {/* Branding inline (mobile / right panel header) */}
            {!registerSuccess && authMode !== "forgot" && <div className="flex items-center gap-2.5 mb-5">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: "rgba(13,148,136,0.12)",
                  border: "1px solid rgba(13,148,136,0.3)",
                  color: "#0D9488",
                }}
              >
                <Stethoscope className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="flex items-center gap-[0.3em]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logos/nodo ver clinica.png"
                  alt="NODO"
                  className="inline-block shrink-0"
                  style={{ height: "22px", width: "auto" }}
                />
                <span className="font-light leading-none text-slate2/60 text-[22px]">|</span>
                <span className="font-display font-extrabold text-ink" style={{ fontSize: "22px" }}>Clínica</span>
              </div>
            </div>}

            {!registerSuccess && authMode !== "forgot" && <>
            <h1 className="font-display font-bold text-ink text-[26px] mb-1">
              {authMode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </h1>
            <p className="text-slate2 text-[14.5px] mb-5">
              {authMode === "login"
                ? isDoctor
                  ? "Ingresá tus credenciales de profesional para acceder al consultorio."
                  : "Ingresá tus credenciales para pedir turno y conectarte por videollamada."
                : "Elegí tu rol y completá los datos para comenzar."}
            </p>

            {/* Role selector — small horizontal compact */}
            <div className="inline-flex rounded-lg border border-mist bg-white p-1 mb-6 gap-1">
              <button
                type="button"
                onClick={() => handleRoleChange("doctor")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-all ${
                  isDoctor
                    ? "bg-brand text-white shadow-sm"
                    : "text-slate2 hover:text-navy"
                }`}
              >
                <Stethoscope className="h-3.5 w-3.5" />
                Soy Médico
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange("patient")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-all ${
                  !isDoctor
                    ? "bg-brand text-white shadow-sm"
                    : "text-slate2 hover:text-navy"
                }`}
              >
                <User className="h-3.5 w-3.5" />
                Soy Paciente
              </button>
            </div>
            </>}

            {/* Login form */}
            {!registerSuccess && authMode === "login" && (
              platformDoctor ? (
                <>
                  {generalError && (
                    <p className="text-[13px] text-[#C0392B] mb-3 text-center">{generalError}</p>
                  )}
                  <PlatformMedicoLoginFields
                    email={form.email}
                    password={form.password}
                    loading={loading}
                    setLoading={setLoading}
                    setGeneralError={setGeneralError}
                    inputBase={inputBase}
                    inputNormal={inputNormal}
                    inputFocus={inputFocus}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                    onEmailChange={(email) => setForm({ ...form, email })}
                    onPasswordChange={(password) => setForm({ ...form, password })}
                  />
                </>
              ) : (
                <form onSubmit={handleLogin} noValidate>
                  <div className="mb-4">
                    <label htmlFor="login-email" className="block text-[13px] font-semibold text-navy mb-1.5">
                      Correo electrónico
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      placeholder="ejemplo@nodocore.com"
                      autoComplete="username"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className={`${inputBase} ${inputNormal} ${inputFocus}`}
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="login-pass" className="block text-[13px] font-semibold text-navy mb-1.5">
                      Contraseña
                    </label>
                    <div className="relative">
                      <input
                        id="login-pass"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className={`${inputBase} ${inputNormal} ${inputFocus} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate2 hover:text-ink cursor-pointer bg-transparent border-none p-1"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-5">
                    <label className="flex items-center gap-2 text-[13px] text-slate2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-brand" />
                      Mantener sesión iniciada
                    </label>
                    <button
                      type="button"
                      onClick={() => { setAuthMode("forgot"); setGeneralError(""); setRecoverySent(false); }}
                      className="text-[13px] font-semibold text-brand hover:underline bg-transparent border-none cursor-pointer p-0"
                    >
                      ¿Olvidó su contraseña?
                    </button>
                  </div>

                  {generalError && (
                    <p className="text-[13px] text-[#C0392B] mb-3 text-center">{generalError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-md bg-brand text-white font-semibold text-[15px] hover:bg-brand-600 active:scale-[.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Ingresar al portal"}
                  </button>

                </form>
              )
            )}

            {/* Register form */}
            {!registerSuccess && authMode === "register" && showRegister && (
              <form onSubmit={handleRegister} noValidate>
                <div className="mb-3">
                  <label className="block text-[13px] font-semibold text-navy mb-1.5">Nombre completo</label>
                  <input
                    type="text"
                    placeholder={isDoctor ? "Dr/a. Juan Pérez" : "Juan Pérez"}
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className={`${inputBase} ${inputNormal} ${inputFocus}`}
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-[13px] font-semibold text-navy mb-1.5">Correo electrónico</label>
                  <input
                    type="email"
                    placeholder="ejemplo@nodocore.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={`${inputBase} ${inputNormal} ${inputFocus}`}
                  />
                </div>
                {generalError && (
                  <p className="text-[13px] text-[#C0392B] mb-4 text-center">{generalError}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-md bg-brand text-white font-semibold text-[15px] hover:bg-brand-600 active:scale-[.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : isDoctor ? (
                    "Crear cuenta de médico"
                  ) : (
                    "Crear cuenta de paciente"
                  )}
                </button>
              </form>
            )}

            {!registerSuccess && authMode === "register" && !showRegister && (
              <div className="text-center py-8">
                <h2 className="font-display font-bold text-ink text-[22px] mb-2">Registro vía NodoCore</h2>
                <p className="text-slate2 text-[14px] mb-6">
                  {isDoctor
                    ? "Los médicos se suscriben desde nodocore.com.ar."
                    : "Creá tu cuenta de paciente desde el portal de registro de Nodo."}
                </p>
                <a
                  href={CLINICA_REGISTRATION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex py-3 px-6 rounded-md bg-brand text-white font-semibold text-[15px] hover:bg-brand-600"
                >
                  Ir a registrarme
                </a>
              </div>
            )}

            {/* Forgot password panel */}
            {authMode === "forgot" && (
              recoverySent ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
                    <MailCheck className="h-7 w-7 text-brand" />
                  </div>
                  <h3 className="font-display font-bold text-ink text-[22px]">Revisá tu correo</h3>
                  <p className="text-slate2 text-[14px] max-w-xs">
                    Te enviamos un enlace de recuperación a{" "}
                    <span className="font-semibold text-ink">{recoveryEmail}</span>.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setAuthMode("login"); setRecoverySent(false); setRecoveryEmail(""); }}
                    className="text-[13px] font-semibold text-brand hover:underline bg-transparent border-none cursor-pointer p-0 mt-2"
                  >
                    Volver al inicio de sesión
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRecovery} noValidate>
                  <div className="flex items-center gap-1.5 mb-3">
                    <KeyRound className="h-3.5 w-3.5 text-brand" />
                    <span className="text-[11px] font-bold tracking-widest uppercase text-brand">
                      Recuperar contraseña
                    </span>
                  </div>
                  <h2 className="font-display font-bold text-ink text-[24px] leading-tight mb-2">
                    ¿Olvidaste tu contraseña?
                  </h2>
                  <p className="text-slate2 text-[14px] mb-5">
                    Ingresá tu correo electrónico para recibir un enlace de recuperación.
                  </p>
                  <div className="mb-4">
                    <label htmlFor="recovery-email" className="block text-[13px] font-semibold text-navy mb-1.5">
                      Correo electrónico
                    </label>
                    <input
                      id="recovery-email"
                      type="email"
                      placeholder="ejemplo@nodocore.com"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      className={`${inputBase} ${inputNormal} ${inputFocus}`}
                      required
                    />
                  </div>
                  {generalError && (
                    <p className="text-[13px] text-[#C0392B] mb-4 text-center">{generalError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-md bg-brand text-white font-semibold text-[15px] hover:bg-brand-600 active:scale-[.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mb-4"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Recuperar ingreso"}
                  </button>
                  <p className="text-center">
                    <button
                      type="button"
                      onClick={() => { setAuthMode("login"); setGeneralError(""); }}
                      className="text-[13px] font-semibold text-brand hover:underline bg-transparent border-none cursor-pointer p-0"
                    >
                      Volver al inicio de sesión
                    </button>
                  </p>
                </form>
              )
            )}
          </div>
        </main>
      </div>
    </>
  );
}
