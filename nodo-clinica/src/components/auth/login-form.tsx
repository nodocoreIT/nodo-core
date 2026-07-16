"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { EcosystemDiagram } from "@/components/nodo/ecosystem-diagram";
import { clinicApi } from "@/lib/clinic/client-api";
import { DEMO_CREDENTIALS } from "@/lib/clinic/config";

interface LoginFormProps {
  defaultRole: "doctor" | "patient";
  unified?: boolean;
}

type AuthMode = "login" | "register";

export function LoginForm({ defaultRole, unified = false }: LoginFormProps) {
  const isDoctor = defaultRole === "doctor";
  const demo = isDoctor ? DEMO_CREDENTIALS.doctor : DEMO_CREDENTIALS.patient;

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [registerRole, setRegisterRole] = useState<"doctor" | "patient">(
    defaultRole === "doctor" ? "doctor" : "patient",
  );
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [form, setForm] = useState({
    email: demo.email,
    password: demo.password,
    fullName: "",
    specialty: "Medicina General",
    licenseNumber: "",
  });

  useEffect(() => {
    if (unified) return;
    clinicApi.getSession().then(({ session }) => {
      if (!session) return;
      if (session.role === "doctor" && isDoctor) {
        window.location.replace("/medico/dashboard");
      } else if (session.role === "patient" && !isDoctor) {
        window.location.replace("/paciente");
      }
    });
  }, [isDoctor, unified]);

  const inputBase =
    "w-full text-[15px] py-[11px] px-[14px] rounded-md bg-white border transition-all duration-150 outline-none";
  const inputNormal = "border-mist text-ink";
  const inputFocus =
    "focus:border-brand focus:shadow-[0_0_0_4px_rgba(218,90,14,.16)]";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError("");
    if (!form.email.trim() || !form.password) {
      setGeneralError("Completá email y contraseña");
      return;
    }

    setLoading(true);
    try {
      await clinicApi.login(
        form.email.trim(),
        form.password,
        defaultRole,
      );
      window.location.replace(isDoctor ? "/medico/dashboard" : "/paciente");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al ingresar";
      setGeneralError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError("");
    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      setGeneralError("Completá todos los campos obligatorios");
      return;
    }

    setLoading(true);
    try {
      await clinicApi.register({
        role: registerRole === "doctor" ? "doctor" : "patient",
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        specialty: form.specialty,
        licenseNumber: form.licenseNumber,
        plan: "trial",
      });
      toast.success("¡Registro exitoso! Bienvenido/a.");
      window.location.href =
        registerRole === "doctor" ? "/medico/dashboard" : "/paciente";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al registrarse";
      setGeneralError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Link
        href="/"
        className="fixed top-[22px] right-[22px] z-10 inline-flex items-center gap-2 px-4 py-2 text-[14px] font-semibold rounded-md bg-brand text-white shadow-sm hover:bg-brand-600 active:scale-[.98] transition-all duration-150"
      >
        ← Volver a la web
      </Link>

      <div className="min-h-screen grid grid-cols-1 login-split">
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
              activeNodeSlug="salud"
              className="w-[min(420px,65%)] aspect-square mx-auto my-3"
            />

            <h2
              className="font-display font-extrabold text-white max-w-[14em]"
              style={{ fontSize: "clamp(26px,2.6vw,34px)", lineHeight: 1.15 }}
            >
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
                <span>Salud</span>
              </span>
            </h2>

            <p
              className="text-[14.5px] leading-relaxed mt-4 max-w-[32em]"
              style={{ color: "rgba(234,240,247,.7)" }}
            >
              Telemedicina profesional: agenda, videoconsultas, historial clínico
              e informes con IA para médicos y pacientes.
            </p>
          </div>

          <div
            className="relative z-[1] text-[13px]"
            style={{ color: "rgba(234,240,247,.5)" }}
          >
            © 2026 Nodo Core · Transparencia tecnológica
          </div>
        </aside>

        <main className="flex items-center justify-center p-8 bg-paper min-h-screen">
          <div className="w-[min(420px,100%)]">
            <div className="flex border-b border-mist mb-6">
              <button
                type="button"
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
                type="button"
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

            {authMode === "login" ? (
              <div>
                <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-brand">
                  {isDoctor ? "◎ Portal Médicos" : "◎ Portal Pacientes"}
                </span>

                <h1 className="font-display font-bold text-ink text-[26px] mt-2 mb-1">
                  Iniciar sesión
                </h1>
                <p className="text-slate2 text-[14.5px] mb-6">
                  {isDoctor
                    ? "Ingresá tus credenciales de profesional para acceder al consultorio."
                    : "Ingresá tus credenciales para pedir turno y conectarte por videollamada."}
                </p>

                <form onSubmit={handleLogin} noValidate>
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
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
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
                        value={form.password}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
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
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      "Ingresar al portal"
                    )}
                  </button>
                </form>

                <p className="text-xs text-center text-slate2 mt-4">
                  Demo: {demo.email} / {demo.password}
                </p>
                {!unified && (
                <p className="text-xs text-center text-slate2 mt-2">
                  ¿Sos {isDoctor ? "paciente" : "médico"}?{" "}
                  <Link
                    href={isDoctor ? "/login/paciente" : "/login/medico"}
                    className="text-brand font-semibold hover:underline"
                  >
                    Cambiar portal
                  </Link>
                </p>
                )}
              </div>
            ) : (
              <div>
                <div className="flex rounded-lg bg-mist/50 p-1 mb-6 border border-mist">
                  <button
                    type="button"
                    onClick={() => setRegisterRole("patient")}
                    className={`flex-1 py-2 rounded-md text-[13.5px] font-bold transition-all ${
                      registerRole === "patient"
                        ? "bg-white text-brand shadow-sm"
                        : "text-slate2 hover:text-navy"
                    }`}
                  >
                    Soy Paciente
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterRole("doctor")}
                    className={`flex-1 py-2 rounded-md text-[13.5px] font-bold transition-all ${
                      registerRole === "doctor"
                        ? "bg-white text-brand shadow-sm"
                        : "text-slate2 hover:text-navy"
                    }`}
                  >
                    Soy Médico
                  </button>
                </div>

                <form onSubmit={handleRegister} noValidate>
                  <h2 className="font-display font-bold text-ink text-[22px] mb-2">
                    {registerRole === "doctor"
                      ? "Registrarse como Médico"
                      : "Registrarse como Paciente"}
                  </h2>
                  <p className="text-slate2 text-[14px] mb-6">
                    {registerRole === "doctor"
                      ? "Digitalizá tu consultorio con agenda, videoconsultas e informes clínicos."
                      : "Reservá turnos online y conectate por videollamada con tu médico."}
                  </p>

                  <div className="mb-3">
                    <label className="block text-[13px] font-semibold text-navy mb-1.5">
                      Nombre completo
                    </label>
                    <input
                      type="text"
                      placeholder={
                        registerRole === "doctor"
                          ? "Dr/a. Juan Pérez"
                          : "Juan Pérez"
                      }
                      value={form.fullName}
                      onChange={(e) =>
                        setForm({ ...form, fullName: e.target.value })
                      }
                      className={`${inputBase} ${inputNormal} ${inputFocus}`}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="block text-[13px] font-semibold text-navy mb-1.5">
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      placeholder="ejemplo@nodocore.com"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      className={`${inputBase} ${inputNormal} ${inputFocus}`}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="block text-[13px] font-semibold text-navy mb-1.5">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                      className={`${inputBase} ${inputNormal} ${inputFocus}`}
                    />
                  </div>

                  {registerRole === "doctor" && (
                    <>
                      <div className="mb-3">
                        <label className="block text-[13px] font-semibold text-navy mb-1.5">
                          Especialidad
                        </label>
                        <input
                          type="text"
                          value={form.specialty}
                          onChange={(e) =>
                            setForm({ ...form, specialty: e.target.value })
                          }
                          className={`${inputBase} ${inputNormal} ${inputFocus}`}
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-[13px] font-semibold text-navy mb-1.5">
                          Matrícula
                        </label>
                        <input
                          type="text"
                          placeholder="MN 12345"
                          value={form.licenseNumber}
                          onChange={(e) =>
                            setForm({ ...form, licenseNumber: e.target.value })
                          }
                          className={`${inputBase} ${inputNormal} ${inputFocus}`}
                        />
                      </div>
                    </>
                  )}

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
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : registerRole === "doctor" ? (
                      "Crear cuenta de médico"
                    ) : (
                      "Crear cuenta de paciente"
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
