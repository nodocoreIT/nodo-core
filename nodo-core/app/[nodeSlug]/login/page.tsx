"use client";

import { useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import EcosystemDiagram from "@/components/EcosystemDiagram";
import { createClient } from "@/lib/supabase/client";
import { getNodeBySlug } from "@/lib/nodes";
import {
  submitDoctorRegistration,
  submitPatientRegistration,
  requestPasswordReset,
  submitInmoRegistration,
} from "@/app/actions";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-navy-900 text-white flex items-center justify-center font-semibold">
          Cargando...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const nodeSlug = params?.nodeSlug as string;
  const nodeParam = nodeSlug || "";
  const modeParam = searchParams.get("mode") || "login";
  const roleParam = searchParams.get("role") || "paciente";

  // Modes: "login" or "register" (only for clinica-virtual)
  // Modes: "login", "register", "forgot" or "reset-password"
  const [authMode, setAuthMode] = useState<
    "login" | "register" | "forgot" | "reset-password"
  >(
    modeParam === "reset-password"
      ? "reset-password"
      : modeParam === "register"
        ? "register"
        : "forgot" === modeParam
          ? "forgot"
          : "login",
  );
  // Register role: "paciente" or "medico"
  const [registerRole, setRegisterRole] = useState<"paciente" | "medico">(
    roleParam === "medico" ? "medico" : "paciente",
  );
  // Doctor Plan: "starter" or "pro"
  const [doctorPlan, setDoctorPlan] = useState<"starter" | "pro">("pro");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameError, setNameError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState<{
    open: boolean;
    type: "paciente" | "medico" | "patient_verify" | "forgot_verify";
    message: string;
  }>({
    open: false,
    type: "paciente",
    message: "",
  });

  const cleanSlug =
    nodeParam === "nodo-clinica" || nodeParam === "clinica-virtual"
      ? "salud"
      : nodeParam.startsWith("nodo-")
        ? nodeParam.slice(5)
        : nodeParam;

  const matchedNode = getNodeBySlug(cleanSlug);

  // Set up details for the left panel based on nodeParam
  let activeNodeSlug: string | undefined = undefined;
  let panelTitle = "El núcleo de gestión de su ecosistema.";
  let panelDesc =
    "Panel de administración para gestionar clientes, unidades de negocio y el roadmap del Core.";

  if (nodeParam === "nodo-clinica" || nodeParam === "clinica-virtual") {
    activeNodeSlug = "salud"; // Connect to Salud in diagram
    panelTitle = "NODO | Clínica Virtual";
    panelDesc =
      "Plataforma HealthTech para telemedicina profesional: consultorios virtuales, recetas digitales e informes automatizados con Inteligencia Artificial.";
  } else if (matchedNode) {
    activeNodeSlug = matchedNode.slug;
    panelTitle = `NODO | ${matchedNode.code}`;
    panelDesc = matchedNode.description;
  }

  const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    setPasswordError("");
    setNameError("");
    setGeneralError("");

    let valid = true;
    if (authMode === "register" && fullName.trim().length < 3) {
      setNameError("Ingrese su nombre completo.");
      valid = false;
    }
    if (!validEmail(email.trim())) {
      setEmailError("Ingrese un correo válido.");
      valid = false;
    }
    if (password.trim().length < 4) {
      setPasswordError(
        authMode === "login"
          ? "Ingrese su contraseña."
          : "La contraseña debe tener al menos 6 caracteres.",
      );
      valid = false;
    }
    if (!valid) return;

    setLoading(true);

    if (authMode === "login") {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setGeneralError(
          "Credenciales incorrectas. Verifique e intente nuevamente.",
        );
        setLoading(false);
        return;
      }
      if (nodeParam === "nodo-inmo" || nodeParam === "inmo") {
        window.location.href = "https://nodoinmo.vercel.app";
      } else if (
        nodeParam === "nodo-clinica" ||
        nodeParam === "clinica-virtual"
      ) {
        const role = data.user?.app_metadata?.role;
        if (role === "medico") {
          window.location.href = "/medico";
        } else if (role === "admin") {
          window.location.href = "/admin";
        } else {
          window.location.href = "/paciente";
        }
      } else {
        router.push("/panel");
      }
    } else {
      const originUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost:3000";

      if (nodeParam === "nodo-inmo" || nodeParam === "inmo") {
        const result = await submitInmoRegistration(
          fullName,
          email,
          password,
          originUrl,
        );

        if (result.status === "error") {
          setGeneralError(result.message);
          setLoading(false);
        } else {
          setGeneralError("");
          setSuccessModal({
            open: true,
            type: "patient_verify", // Show the orange-themed envelope mail verification modal
            message: result.message,
          });
          setLoading(false);
        }
      } else if (registerRole === "medico") {
        const result = await submitDoctorRegistration(
          fullName,
          email,
          password,
          doctorPlan,
          originUrl,
        );

        if (result.status === "error") {
          setGeneralError(result.message);
          setLoading(false);
        } else {
          setGeneralError("");
          setSuccessModal({
            open: true,
            type: "medico",
            message: result.message,
          });
          setLoading(false);
        }
      } else {
        const result = await submitPatientRegistration(
          fullName,
          email,
          password,
          originUrl,
        );

        if (result.status === "error") {
          setGeneralError(result.message);
          setLoading(false);
        } else {
          setGeneralError("");
          setSuccessModal({
            open: true,
            type: "patient_verify", // Show the green-themed envelope mail verification modal for patients
            message: result.message,
          });
          setLoading(false);
        }
      }
    }
  }

  const handleGoogleRegister = async () => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/panel`,
      },
    });
    if (error) {
      setGeneralError(error.message);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/panel`,
      },
    });
    if (error) {
      setGeneralError(error.message);
      setLoading(false);
    }
  };

  async function handleForgotPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    setGeneralError("");

    if (!validEmail(email.trim())) {
      setEmailError("Ingrese un correo válido.");
      return;
    }

    setLoading(true);
    const originUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";

    const result = await requestPasswordReset(
      email.trim(),
      nodeParam,
      originUrl,
    );

    if (result.status === "error") {
      setGeneralError(result.message);
      setLoading(false);
    } else {
      setSuccessModal({
        open: true,
        type: "forgot_verify",
        message: result.message,
      });
      setLoading(false);
    }
  }

  async function handleResetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setGeneralError("");

    if (password.trim().length < 6) {
      setPasswordError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({
      password: password.trim(),
    });

    if (error) {
      setGeneralError(error.message);
      setLoading(false);
    } else {
      setSuccessModal({
        open: true,
        type: "paciente",
        message:
          "Tu contraseña se ha restablecido con éxito. Ya podés ingresar.",
      });
      setLoading(false);
    }
  }

  const inputBase =
    "w-full text-[15px] py-[11px] px-[14px] rounded-md bg-white border transition-all duration-150 outline-none";
  const inputNormal = "border-mist text-ink";
  const inputError = "border-[#C0392B] shadow-[0_0_0_4px_rgba(192,57,43,.12)]";
  const inputFocus =
    "focus:border-brand focus:shadow-[0_0_0_4px_rgba(218,90,14,.16)]";

  return (
    <>
      {/* Back button */}
      <Link
        href={
          nodeParam === "nodo-clinica" || nodeParam === "clinica-virtual"
            ? "/nodo-salud/clinica-virtual"
            : matchedNode
              ? `/nodo-${matchedNode.slug}`
              : "/"
        }
        className="fixed top-[22px] right-[22px] z-10 inline-flex items-center gap-2 px-4 py-2 text-[14px] font-semibold rounded-md bg-brand text-white shadow-sm hover:bg-brand-600 active:scale-[.98] transition-all duration-150"
      >
        ← Volver a la web
      </Link>

      <div className="min-h-screen grid grid-cols-1 login-split">
        {/* Brand panel (left) */}
        <aside className="login-brand-panel relative overflow-hidden bg-navy-900 text-white p-12 flex-col justify-between hidden">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(70% 50% at 30% 30%, rgba(218,90,14,.20), transparent 70%)",
            }}
          />

          <div className="relative z-[1]">
            <Image
              src="/logos/logo compuesto estrella az letra blancazzz.png"
              alt="Nodo Core"
              height={30}
              width={140}
              className="h-[30px] w-auto"
            />
          </div>

          <div className="relative z-[1]">
            <EcosystemDiagram
              dark
              interactive
              isLoginPage
              activeNodeSlug={activeNodeSlug}
              className="w-[min(420px,65%)] aspect-square mx-auto my-3"
            />

            <h2
              className="font-display font-extrabold text-white max-w-[14em]"
              style={{ fontSize: "clamp(26px,2.6vw,34px)", lineHeight: 1.15 }}
            >
              {panelTitle.includes("|") ? (
                <span className="flex items-center gap-[0.3em]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logos/nodo nar.png"
                    alt="NODO"
                    style={{
                      height: "0.82em",
                      width: "auto",
                      display: "inline-block",
                      verticalAlign: "middle",
                    }}
                  />
                  <span className="text-white/40 font-normal mx-1">|</span>
                  <span>{panelTitle.split("|")[1].trim()}</span>
                </span>
              ) : (
                panelTitle
              )}
            </h2>

            <p
              className="text-[14.5px] leading-relaxed mt-4 max-w-[32em]"
              style={{ color: "rgba(234,240,247,.7)" }}
            >
              {panelDesc}
            </p>
          </div>

          <div
            className="relative z-[1] text-[13px]"
            style={{ color: "rgba(234,240,247,.5)" }}
          >
            © 2026 Nodo Core · Transparencia tecnológica
          </div>
        </aside>

        {/* Form panel (right) */}
        <main className="flex items-center justify-center p-8 bg-paper min-h-screen">
          <div className="w-[min(420px,100%)]">
            {/* If node is Clinica Virtual or Inmo, show Iniciar / Registrar toggle */}
            {(nodeParam === "nodo-clinica" ||
              nodeParam === "clinica-virtual" ||
              nodeParam === "nodo-inmo" ||
              nodeParam === "inmo") &&
              (authMode === "login" || authMode === "register") && (
                <div className="flex border-b border-mist mb-6">
                  <button
                    onClick={() => {
                      setAuthMode("login");
                      setGeneralError("");
                    }}
                    className={`flex-1 pb-3 text-[15px] font-bold transition-colors border-b-2 ${
                      authMode === "login"
                        ? "border-brand text-brand"
                        : "border-transparent text-slate2 hover:text-navy"
                    }`}
                  >
                    Iniciar sesión
                  </button>
                  <button
                    onClick={() => {
                      setAuthMode("register");
                      setGeneralError("");
                    }}
                    className={`flex-1 pb-3 text-[15px] font-bold transition-colors border-b-2 ${
                      authMode === "register"
                        ? "border-brand text-brand"
                        : "border-transparent text-slate2 hover:text-navy"
                    }`}
                  >
                    Registrarse
                  </button>
                </div>
              )}

            {authMode === "login" ? (
              <div>
                {/* Kicker */}
                <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-brand">
                  {nodeParam === "nodo-clinica" ||
                  nodeParam === "clinica-virtual"
                    ? "◎ Portal Clínica Virtual"
                    : nodeParam === "nodo-inmo" || nodeParam === "inmo"
                      ? "◎ Portal Inmobiliarias"
                      : "◎ Acceso administradores"}
                </span>

                <h1 className="font-display font-bold text-ink text-[26px] mt-2 mb-1">
                  Iniciar sesión
                </h1>
                <p className="text-slate2 text-[14.5px] mb-6">
                  {nodeParam === "nodo-clinica" ||
                  nodeParam === "clinica-virtual"
                    ? "Ingrese sus credenciales de profesional o paciente para acceder."
                    : nodeParam === "nodo-inmo" || nodeParam === "inmo"
                      ? "Ingrese sus credenciales de dueño de inmobiliaria para acceder."
                      : "Ingrese sus credenciales para acceder al panel de Nodo Core."}
                </p>

                {(nodeParam === "nodo-clinica" ||
                  nodeParam === "clinica-virtual") && (
                  <>
                    {/* Google Login for Patients */}
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="w-full inline-flex items-center justify-center py-3 px-4 rounded-md border border-mist bg-white text-ink text-[14.5px] font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer disabled:opacity-60 mb-5"
                    >
                      <svg
                        className="w-5 h-5 mr-2.5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      Iniciar sesión con Google
                    </button>

                    {/* Divider */}
                    <div className="relative my-6">
                      <div
                        className="absolute inset-0 flex items-center"
                        aria-hidden="true"
                      >
                        <div className="w-full border-t border-mist" />
                      </div>
                      <div className="relative flex justify-center text-[11px] uppercase">
                        <span className="bg-paper px-3 text-slate2 font-bold tracking-wider">
                          o con correo electrónico
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  {/* Email */}
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
                      placeholder="ejemplo@nodocore.com"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError("");
                      }}
                      className={`${inputBase} ${emailError ? inputError : inputNormal} ${inputFocus}`}
                    />
                    {emailError && (
                      <p className="text-[12.5px] text-[#C0392B] mt-1.5">
                        {emailError}
                      </p>
                    )}
                  </div>

                  {/* Password */}
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
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPasswordError("");
                        }}
                        className={`${inputBase} ${passwordError ? inputError : inputNormal} ${inputFocus} pr-16`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate2 hover:text-ink cursor-pointer select-none bg-transparent border-none p-1"
                      >
                        {showPassword ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {passwordError && (
                      <p className="text-[12.5px] text-[#C0392B] mt-1.5">
                        {passwordError}
                      </p>
                    )}
                  </div>

                  {/* Remember + forgot */}
                  <div className="flex items-center justify-between mb-5">
                    <label className="flex items-center gap-2 text-[13px] text-slate2 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="accent-brand"
                      />
                      Mantener sesión iniciada
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("forgot");
                        setGeneralError("");
                      }}
                      className="text-[13px] text-brand font-semibold cursor-pointer bg-transparent border-none outline-none hover:underline"
                    >
                      ¿Olvidó su contraseña?
                    </button>
                  </div>

                  {/* General error */}
                  {generalError && (
                    <p className="text-[13px] text-[#C0392B] mb-3 text-center">
                      {generalError}
                    </p>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-md bg-brand text-white font-semibold text-[15px] hover:bg-brand-600 active:scale-[.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? "Ingresando…" : "Ingresar al portal"}
                  </button>
                </form>
              </div>
            ) : authMode === "forgot" ? (
              <form onSubmit={handleForgotPasswordSubmit} noValidate>
                <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-brand">
                  ◎ Recuperar contraseña
                </span>
                <h1 className="font-display font-bold text-ink text-[26px] mt-2 mb-1">
                  ¿Olvidaste tu contraseña?
                </h1>
                <p className="text-slate2 text-[14.5px] mb-6">
                  Ingresá tu correo electrónico para recibir un enlace de
                  recuperación.
                </p>

                <div className="mb-4">
                  <label
                    htmlFor="forgot-email"
                    className="block text-[13px] font-semibold text-navy mb-1.5"
                  >
                    Correo electrónico
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="ejemplo@nodocore.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError("");
                    }}
                    className={`${inputBase} ${emailError ? inputError : inputNormal} ${inputFocus}`}
                  />
                  {emailError && (
                    <p className="text-[12.5px] text-[#C0392B] mt-1.5">
                      {emailError}
                    </p>
                  )}
                </div>

                {generalError && (
                  <p className="text-[13px] text-[#C0392B] mb-3 text-center">
                    {generalError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-md bg-brand text-white font-semibold text-[15px] hover:bg-brand-600 active:scale-[.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? "Enviando…" : "Recuperar ingreso"}
                </button>

                <div className="text-center mt-5">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setGeneralError("");
                    }}
                    className="text-[13.5px] font-semibold text-brand hover:underline bg-transparent border-none cursor-pointer"
                  >
                    Volver al inicio de sesión
                  </button>
                </div>
              </form>
            ) : authMode === "reset-password" ? (
              <form onSubmit={handleResetPasswordSubmit} noValidate>
                <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-brand">
                  ◎ Restablecer contraseña
                </span>
                <h1 className="font-display font-bold text-ink text-[26px] mt-2 mb-1">
                  Nueva contraseña
                </h1>
                <p className="text-slate2 text-[14.5px] mb-6">
                  Ingresá una nueva contraseña segura para tu cuenta.
                </p>

                <div className="mb-4">
                  <label
                    htmlFor="reset-pass"
                    className="block text-[13px] font-semibold text-navy mb-1.5"
                  >
                    Nueva contraseña
                  </label>
                  <input
                    id="reset-pass"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError("");
                    }}
                    className={`${inputBase} ${passwordError ? inputError : inputNormal} ${inputFocus}`}
                  />
                  {passwordError && (
                    <p className="text-[12.5px] text-[#C0392B] mt-1.5">
                      {passwordError}
                    </p>
                  )}
                </div>

                {generalError && (
                  <p className="text-[13px] text-[#C0392B] mb-3 text-center">
                    {generalError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-md bg-brand text-white font-semibold text-[15px] hover:bg-brand-600 active:scale-[.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? "Restableciendo…" : "Restablecer contraseña"}
                </button>
              </form>
            ) : (
              /* Register Mode (only for Clinica Virtual & Inmo) */
              <div>
                {nodeParam === "inmo" ? (
                  /* Inmo registration view (simplified) */
                  <form onSubmit={handleSubmit} noValidate>
                    <h2 className="font-display font-bold text-ink text-[22px] text-center mb-2">
                      Registrarse como dueño de inmobiliaria
                    </h2>
                    <p className="text-slate2 text-[14px] text-center mb-6">
                      Registrarse como dueño de inmobiliaria únicamente.
                    </p>

                    {/* Name */}
                    <div className="mb-3">
                      <label
                        htmlFor="reg-inmo-name"
                        className="block text-[13px] font-semibold text-navy mb-1.5"
                      >
                        Nombre completo
                      </label>
                      <input
                        id="reg-inmo-name"
                        type="text"
                        placeholder="Juan Pérez"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          setNameError("");
                        }}
                        className={`${inputBase} ${nameError ? inputError : inputNormal} ${inputFocus}`}
                      />
                      {nameError && (
                        <p className="text-[12.5px] text-[#C0392B] mt-1.5">
                          {nameError}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="mb-3">
                      <label
                        htmlFor="reg-inmo-email"
                        className="block text-[13px] font-semibold text-navy mb-1.5"
                      >
                        Correo electrónico
                      </label>
                      <input
                        id="reg-inmo-email"
                        type="email"
                        placeholder="inmobiliaria@ejemplo.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setEmailError("");
                        }}
                        className={`${inputBase} ${emailError ? inputError : inputNormal} ${inputFocus}`}
                      />
                      {emailError && (
                        <p className="text-[12.5px] text-[#C0392B] mt-1.5">
                          {emailError}
                        </p>
                      )}
                    </div>

                    {/* Password */}
                    <div className="mb-4">
                      <label
                        htmlFor="reg-inmo-pass"
                        className="block text-[13px] font-semibold text-navy mb-1.5"
                      >
                        Contraseña
                      </label>
                      <input
                        id="reg-inmo-pass"
                        type="password"
                        placeholder="Crea una contraseña segura"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPasswordError("");
                        }}
                        className={`${inputBase} ${passwordError ? inputError : inputNormal} ${inputFocus}`}
                      />
                      {passwordError && (
                        <p className="text-[12.5px] text-[#C0392B] mt-1.5">
                          {passwordError}
                        </p>
                      )}
                    </div>

                    {/* General error */}
                    {generalError && (
                      <p className="text-[13px] text-[#C0392B] mb-4 text-center">
                        {generalError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 rounded-md bg-brand text-white font-semibold text-[15px] hover:bg-brand-600 active:scale-[.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {loading
                        ? "Registrando…"
                        : "Crear cuenta de inmobiliaria"}
                    </button>
                  </form>
                ) : (
                  /* Clinica Virtual registration view with role toggles */
                  <div>
                    {/* Role Toggle Selector */}
                    <div className="flex rounded-lg bg-mist/50 p-1 mb-6 border border-mist">
                      <button
                        onClick={() => setRegisterRole("paciente")}
                        className={`flex-1 py-2 rounded-md text-[13.5px] font-bold transition-all ${
                          registerRole === "paciente"
                            ? "bg-white text-brand shadow-sm"
                            : "text-slate2 hover:text-navy"
                        }`}
                      >
                        Soy Paciente
                      </button>
                      <button
                        onClick={() => setRegisterRole("medico")}
                        className={`flex-1 py-2 rounded-md text-[13.5px] font-bold transition-all ${
                          registerRole === "medico"
                            ? "bg-white text-brand shadow-sm"
                            : "text-slate2 hover:text-navy"
                        }`}
                      >
                        Soy Médico
                      </button>
                    </div>

                    {registerRole === "paciente" ? (
                      <div>
                        <div className="text-center">
                          <h2 className="font-display font-bold text-ink text-[22px] mb-2">
                            Registrarse como Paciente
                          </h2>
                          <p className="text-slate2 text-[14px] mb-6">
                            El registro es 100% gratuito. Podrás agendar turnos
                            y realizar videoconsultas al instante.
                          </p>

                          {/* Google Sign In */}
                          <button
                            type="button"
                            onClick={handleGoogleRegister}
                            disabled={loading}
                            className="w-full inline-flex items-center justify-center py-3 px-4 rounded-md border border-mist bg-white text-ink text-[14.5px] font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer disabled:opacity-60"
                          >
                            <svg
                              className="w-5 h-5 mr-2.5"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                              />
                              <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                              />
                              <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                fill="#FBBC05"
                              />
                              <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                              />
                            </svg>
                            Registrarse con Google
                          </button>
                        </div>

                        {/* Divider */}
                        <div className="relative my-6">
                          <div
                            className="absolute inset-0 flex items-center"
                            aria-hidden="true"
                          >
                            <div className="w-full border-t border-mist" />
                          </div>
                          <div className="relative flex justify-center text-[11px] uppercase">
                            <span className="bg-paper px-3 text-slate2 font-bold tracking-wider">
                              o con correo electrónico
                            </span>
                          </div>
                        </div>

                        {/* Email Sign In Form */}
                        <form onSubmit={handleSubmit} noValidate>
                          {/* Name */}
                          <div className="mb-3">
                            <label
                              htmlFor="reg-patient-name"
                              className="block text-[13px] font-semibold text-navy mb-1.5"
                            >
                              Nombre completo
                            </label>
                            <input
                              id="reg-patient-name"
                              type="text"
                              placeholder="Juan Pérez"
                              value={fullName}
                              onChange={(e) => {
                                setFullName(e.target.value);
                                setNameError("");
                              }}
                              className={`${inputBase} ${nameError ? inputError : inputNormal} ${inputFocus}`}
                            />
                            {nameError && (
                              <p className="text-[12.5px] text-[#C0392B] mt-1.5">
                                {nameError}
                              </p>
                            )}
                          </div>

                          {/* Email */}
                          <div className="mb-3">
                            <label
                              htmlFor="reg-patient-email"
                              className="block text-[13px] font-semibold text-navy mb-1.5"
                            >
                              Correo electrónico
                            </label>
                            <input
                              id="reg-patient-email"
                              type="email"
                              placeholder="paciente@ejemplo.com"
                              value={email}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                setEmailError("");
                              }}
                              className={`${inputBase} ${emailError ? inputError : inputNormal} ${inputFocus}`}
                            />
                            {emailError && (
                              <p className="text-[12.5px] text-[#C0392B] mt-1.5">
                                {emailError}
                              </p>
                            )}
                          </div>

                          {/* Password */}
                          <div className="mb-4">
                            <label
                              htmlFor="reg-patient-pass"
                              className="block text-[13px] font-semibold text-navy mb-1.5"
                            >
                              Contraseña
                            </label>
                            <input
                              id="reg-patient-pass"
                              type="password"
                              placeholder="Crea una contraseña segura"
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                setPasswordError("");
                              }}
                              className={`${inputBase} ${passwordError ? inputError : inputNormal} ${inputFocus}`}
                            />
                            {passwordError && (
                              <p className="text-[12.5px] text-[#C0392B] mt-1.5">
                                {passwordError}
                              </p>
                            )}
                          </div>

                          {/* General error */}
                          {generalError && (
                            <p className="text-[13px] text-[#C0392B] mb-4 text-center">
                              {generalError}
                            </p>
                          )}

                          {/* Submit Patient Email signup */}
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 rounded-md bg-emerald-600 text-white font-semibold text-[15px] hover:bg-emerald-700 active:scale-[.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {loading
                              ? "Registrando…"
                              : "Crear cuenta de paciente"}
                          </button>
                        </form>

                        <p className="text-slate2 text-[12px] mt-4 text-center font-medium">
                          Al registrarte aceptas los Términos de Servicio y la
                          Política de Privacidad de NODO | Clínica Virtual.
                        </p>
                      </div>
                    ) : (
                      /* Professional Doctor signup */
                      <form onSubmit={handleSubmit} noValidate>
                        <h2 className="font-display font-bold text-ink text-[22px] text-center mb-2">
                          Registrarse como Médico
                        </h2>
                        <p className="text-slate2 text-[14px] text-center mb-6">
                          Comenzá tu periodo de prueba y digitalizá tu
                          consultorio hoy mismo.
                        </p>

                        {/* Plan Selector */}
                        <div className="mb-5">
                          <label className="block text-[13px] font-semibold text-navy mb-2">
                            Seleccione su Plan
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setDoctorPlan("starter")}
                              className={`p-3 rounded-lg border text-left transition-all ${
                                doctorPlan === "starter"
                                  ? "border-brand bg-brand/5 shadow-sm"
                                  : "border-mist bg-white hover:bg-slate-50"
                              }`}
                            >
                              <div className="font-bold text-[14.5px] text-navy">
                                Plan Starter
                              </div>
                              <div className="text-[12px] text-slate2 mt-1">
                                Agenda y recetas
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDoctorPlan("pro")}
                              className={`p-3 rounded-lg border text-left transition-all ${
                                doctorPlan === "pro"
                                  ? "border-brand bg-brand/5 shadow-sm"
                                  : "border-mist bg-white hover:bg-slate-50"
                              }`}
                            >
                              <div className="font-bold text-[14.5px] text-brand flex items-center justify-between">
                                Plan Pro
                                <span className="bg-brand/10 text-brand text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded">
                                  IA
                                </span>
                              </div>
                              <div className="text-[12px] text-slate2 mt-1">
                                SOAP + IA ilimitado
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Name */}
                        <div className="mb-3">
                          <label
                            htmlFor="reg-name"
                            className="block text-[13px] font-semibold text-navy mb-1.5"
                          >
                            Nombre completo
                          </label>
                          <input
                            id="reg-name"
                            type="text"
                            placeholder="Dr./Dra. Juan Pérez"
                            value={fullName}
                            onChange={(e) => {
                              setFullName(e.target.value);
                              setNameError("");
                            }}
                            className={`${inputBase} ${nameError ? inputError : inputNormal} ${inputFocus}`}
                          />
                          {nameError && (
                            <p className="text-[12.5px] text-[#C0392B] mt-1.5">
                              {nameError}
                            </p>
                          )}
                        </div>

                        {/* Email */}
                        <div className="mb-3">
                          <label
                            htmlFor="reg-email"
                            className="block text-[13px] font-semibold text-navy mb-1.5"
                          >
                            Correo electrónico profesional
                          </label>
                          <input
                            id="reg-email"
                            type="email"
                            placeholder="medico@ejemplo.com"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              setEmailError("");
                            }}
                            className={`${inputBase} ${emailError ? inputError : inputNormal} ${inputFocus}`}
                          />
                          {emailError && (
                            <p className="text-[12.5px] text-[#C0392B] mt-1.5">
                              {emailError}
                            </p>
                          )}
                        </div>

                        {/* General error */}
                        {generalError && (
                          <p className="text-[13px] text-[#C0392B] mb-4 text-center">
                            {generalError}
                          </p>
                        )}

                        {/* Submit Registration */}
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-3.5 rounded-md bg-brand text-white font-semibold text-[15px] hover:bg-brand-600 active:scale-[.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {loading
                            ? "Registrando…"
                            : `Registrarme en Plan ${doctorPlan === "pro" ? "Pro" : "Starter"}`}
                        </button>
                        <p className="text-slate2 text-[12px] mt-4 text-center font-medium">
                          Al registrarte aceptas los Términos de Servicio y la
                          Política de Privacidad de NODO | Inmo.
                        </p>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Premium Custom Modal */}
      {successModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white text-ink rounded-2xl p-7 max-w-sm w-full shadow-2xl border border-mist text-center animate-in zoom-in-95 duration-200">
            {successModal.type === "medico" ? (
              // Doctor / Email verification view
              <>
                <div className="h-14 w-14 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-5 border border-brand/20">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-7 w-7"
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <h3 className="font-display font-extrabold text-navy text-[21px] mb-2.5">
                  ¡Verificá tu casilla!
                </h3>
                <p className="text-slate2 text-[14px] leading-relaxed mb-6">
                  {successModal.message}
                </p>
                <button
                  onClick={() => {
                    setSuccessModal({
                      open: false,
                      type: "medico",
                      message: "",
                    });
                    router.push("/nodo-salud/clinica-virtual");
                  }}
                  className="w-full py-3 rounded-lg bg-brand text-white font-bold text-[14.5px] hover:bg-brand-600 active:scale-[.98] transition-all cursor-pointer shadow-md shadow-brand/15"
                >
                  Entendido
                </button>
              </>
            ) : successModal.type === "forgot_verify" ? (
              // Forgot Password recovery email sent success view
              <>
                <div className="h-14 w-14 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-5 border border-brand/20">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-7 w-7"
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <h3 className="font-display font-extrabold text-navy text-[21px] mb-2.5">
                  ¡Recuperá tu cuenta!
                </h3>
                <p className="text-slate2 text-[14px] leading-relaxed mb-6">
                  {successModal.message}
                </p>
                <button
                  onClick={() => {
                    setSuccessModal({
                      open: false,
                      type: "forgot_verify",
                      message: "",
                    });
                    setAuthMode("login");
                  }}
                  className="w-full py-3 rounded-lg bg-brand text-white font-bold text-[14.5px] hover:bg-brand-600 active:scale-[.98] transition-all cursor-pointer shadow-md shadow-brand/15"
                >
                  Entendido
                </button>
              </>
            ) : successModal.type === "patient_verify" ? (
              // Patient / Email verification view
              <>
                <div className="h-14 w-14 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-5 border border-brand/20">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-7 w-7"
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <h3 className="font-display font-extrabold text-navy text-[21px] mb-2.5">
                  ¡Activá tu cuenta!
                </h3>
                <p className="text-slate2 text-[14px] leading-relaxed mb-6">
                  {successModal.message}
                </p>
                <button
                  onClick={() => {
                    setSuccessModal({
                      open: false,
                      type: "patient_verify",
                      message: "",
                    });
                    router.push(
                      nodeParam === "inmo"
                        ? "/nodo-inmo"
                        : "/nodo-salud/clinica-virtual",
                    );
                  }}
                  className="w-full py-3 rounded-lg bg-brand text-white font-bold text-[14.5px] hover:bg-brand-600 active:scale-[.98] transition-all cursor-pointer shadow-md shadow-brand/15"
                >
                  Entendido
                </button>
              </>
            ) : (
              // Patient / Google register success view
              <>
                <div className="h-14 w-14 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-5 border border-emerald-500/20">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-7 w-7"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="font-display font-extrabold text-emerald-600 text-[21px] mb-2.5">
                  ¡Bienvenido a NODO!
                </h3>
                <p className="text-slate2 text-[14px] leading-relaxed mb-6">
                  {successModal.message}
                </p>
                <button
                  onClick={() => {
                    setSuccessModal({
                      open: false,
                      type: "paciente",
                      message: "",
                    });
                    router.push("/panel");
                  }}
                  className="w-full py-3 rounded-lg bg-emerald-600 text-white font-bold text-[14.5px] hover:bg-emerald-700 active:scale-[.98] transition-all cursor-pointer shadow-md shadow-emerald-600/15"
                >
                  Ingresar al Panel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
