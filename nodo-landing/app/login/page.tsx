"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import EcosystemDiagram from "@/components/EcosystemDiagram";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-navy-900 text-white flex items-center justify-center font-semibold">
          Cargando...
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const router = useRouter();

  const [authMode, setAuthMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const inputBase =
    "w-full text-[15px] py-[11px] px-[14px] rounded-md bg-white border transition-all duration-150 outline-none";
  const inputNormal = "border-mist text-ink";
  const inputError = "border-[#C0392B] shadow-[0_0_0_4px_rgba(192,57,43,.12)]";
  const inputFocus =
    "focus:border-brand focus:shadow-[0_0_0_4px_rgba(218,90,14,.16)]";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    setPasswordError("");
    setGeneralError("");

    let valid = true;
    if (!validEmail(email.trim())) {
      setEmailError("Ingrese un correo válido.");
      valid = false;
    }
    if (password.trim().length < 4) {
      setPasswordError("Ingrese su contraseña.");
      valid = false;
    }
    if (!valid) return;

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      setGeneralError("Credenciales incorrectas. Verificá e intentá nuevamente.");
      setLoading(false);
      return;
    }

    router.push("/panel");
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    setGeneralError("");

    if (!validEmail(email.trim())) {
      setEmailError("Ingrese un correo válido.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login?mode=reset-password`,
    });

    setLoading(false);
    if (error) {
      setGeneralError(error.message);
    } else {
      setForgotSent(true);
    }
  }

  return (
    <>
      <Link
        href="/"
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
              width={140}
              height={30}
              style={{ height: "30px", width: "auto" }}
            />
          </div>

          <div className="relative z-[1]">
            <EcosystemDiagram
              dark
              interactive
              isLoginPage
              className="w-[min(420px,65%)] aspect-square mx-auto my-3"
            />

            <h2
              className="font-display font-extrabold text-white max-w-[14em]"
              style={{ fontSize: "clamp(26px,2.6vw,34px)", lineHeight: 1.15 }}
            >
              El núcleo de gestión de su ecosistema.
            </h2>

            <p
              className="text-[14.5px] leading-relaxed mt-4 max-w-[32em]"
              style={{ color: "rgba(234,240,247,.7)" }}
            >
              Panel de administración para gestionar clientes, unidades de
              negocio y el roadmap del Core.
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
            {authMode === "login" ? (
              <div>
                <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-brand">
                  ◎ Acceso administradores
                </span>

                <h1 className="font-display font-bold text-ink text-[26px] mt-2 mb-1">
                  Iniciar sesión
                </h1>
                <p className="text-slate2 text-[14.5px] mb-6">
                  Ingrese sus credenciales para acceder al panel de Nodo Core.
                </p>

                <form onSubmit={handleLogin} noValidate>
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
                    {loading ? "Ingresando…" : "Ingresar al panel"}
                  </button>
                </form>
              </div>
            ) : forgotSent ? (
              <div className="text-center">
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
                  Revisá tu casilla
                </h3>
                <p className="text-slate2 text-[14px] leading-relaxed mb-6">
                  Te enviamos un enlace de recuperación a{" "}
                  <span className="font-semibold text-ink">{email}</span>.
                </p>
                <button
                  onClick={() => {
                    setForgotSent(false);
                    setAuthMode("login");
                  }}
                  className="text-[13.5px] font-semibold text-brand hover:underline bg-transparent border-none cursor-pointer"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} noValidate>
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
            )}
          </div>
        </main>
      </div>
    </>
  );
}
