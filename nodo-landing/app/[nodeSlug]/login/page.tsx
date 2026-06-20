"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import EcosystemDiagram from "@/components/EcosystemDiagram";
import { Layers } from "lucide-react";
import {
  PasswordResetPanel,
  usePasswordRecoveryBootstrap,
  enforceNodeAccess,
  INVALID_LOGIN_MESSAGE,
  AUTH_ERROR_CREDENTIALS,
  mustSetPassword,
  fetchMustSetPassword,
} from "@nodocore/shared-components";
import { createNodeBrowserClient } from "@/lib/supabase/nodo-browser";
import { getNodeBySlug, getNodeMailLabel, getChildNodes, needsModulePicker } from "@/lib/nodes";
import {
  submitDoctorRegistration,
  submitPatientRegistration,
  requestPasswordReset,
  submitInmoRegistration,
} from "@/app/actions";
import { submitNodeRegistration } from "@/app/actions/registration";
import {
  DEFAULT_ACCENT,
  getLoginAccent,
  getNodoLogoSrc,
  applyLoginAccent,
  type NodeAccent,
} from "@/lib/node-accents";

function redirectToFinanzasAuth(accessToken: string, refreshToken: string) {
  try {
    sessionStorage.setItem("nodo-finanzas-skip-splash", "1");
  } catch {
    // ignore
  }
  window.location.href = `/finanzas/auth/callback#access_token=${accessToken}&refresh_token=${refreshToken}`;
}

function NodeTransitionOverlay({
  label,
  code,
  Icon,
  logoSrc = "/logos/nodo%20nar.png",
  accent = DEFAULT_ACCENT,
}: {
  label: string;
  code: string;
  Icon: React.ElementType;
  logoSrc?: string;
  accent?: NodeAccent;
}) {
  const [mounted, setMounted] = useState(false);
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setMounted(true);
      const t = setTimeout(() => setBarWidth(100), 60);
      return () => clearTimeout(t);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: "var(--color-navy-900)" }}
    >
      {/* Radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.6s ease",
          background:
            `radial-gradient(55% 55% at 50% 52%, rgba(${accent.rgb},.22), transparent 70%)`,
        }}
      />

      {/* Main content */}
      <div
        className="relative flex flex-col items-center"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.45s ease, transform 0.45s ease",
        }}
      >
        {/* Icon with pulsing rings */}
        <div className="relative flex items-center justify-center">
          <span
            className="absolute rounded-full"
            style={{
              width: 128,
              height: 128,
              backgroundColor: `rgba(${accent.rgb},.12)`,
              animation: "nodo-ping 1.5s cubic-bezier(0,0,.2,1) infinite",
            }}
          />
          <span
            className="absolute rounded-full"
            style={{
              width: 100,
              height: 100,
              backgroundColor: `rgba(${accent.rgb},.08)`,
              animation: "nodo-ping 1.5s cubic-bezier(0,0,.2,1) 0.3s infinite",
            }}
          />
          <span
            className="relative flex items-center justify-center rounded-full"
            style={{
              width: 84,
              height: 84,
              backgroundColor: `rgba(${accent.rgb},.15)`,
              border: `1.5px solid rgba(${accent.rgb},.35)`,
            }}
          >
            <Icon
              aria-hidden
              style={{ width: 38, height: 38, color: accent.brand }}
              strokeWidth={1.6}
            />
          </span>
        </div>

        {/* Label */}
        <p
          className="mt-10 text-[12px] font-bold uppercase tracking-[.2em]"
          style={{ color: "rgba(234,240,247,.4)" }}
        >
          Entrando a
        </p>
        <h2
          className="mt-2 font-display font-extrabold text-white text-center flex items-center justify-center gap-x-3.5 gap-y-1"
          style={{ fontSize: "clamp(28px,5vw,52px)", lineHeight: 1.06 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt=""
            style={{
              height: "0.78em",
              width: "auto",
              display: "inline-block",
            }}
          />
          <span style={{ color: "#fff", fontWeight: 400 }}>|</span>
          <span>{code}</span>
        </h2>

        {/* Dots */}
        <div className="mt-8 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: 6,
                height: 6,
                backgroundColor: accent.brand,
                opacity: 0.3,
                animation: `nodo-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 3, backgroundColor: "rgba(255,255,255,.07)" }}
      >
        <div
          style={{
            height: "100%",
            backgroundColor: accent.brand,
            width: `${barWidth}%`,
            transition: "width 1.4s cubic-bezier(.4,0,.2,1)",
          }}
        />
      </div>

      <style>{`
        @keyframes nodo-ping {
          75%, to { transform: scale(1.7); opacity: 0; }
        }
        @keyframes nodo-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: .3; }
          40%            { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

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

  const authSupabase = useMemo(
    () => createNodeBrowserClient(nodeParam),
    [nodeParam],
  );

  const initialAuthMode =
    modeParam === "reset-password"
      ? "reset-password"
      : modeParam === "first-access"
        ? "first-access"
        : modeParam === "register"
          ? "register"
          : modeParam === "forgot"
            ? "forgot"
            : "login";

  const isClinicaNode =
    nodeParam === "nodo-clinica" ||
    nodeParam === "clinica-virtual" ||
    nodeParam === "clinica";
  const isInmoNode = nodeParam === "nodo-inmo" || nodeParam === "inmo";
  const isAutosNode = nodeParam === "nodo-autos" || nodeParam === "autos";
  const isFinanzasNode =
    nodeParam === "nodo-finanzas" || nodeParam === "finanzas";
  const isTiendaNode = nodeParam === "nodo-tienda" || nodeParam === "tienda";
  const isSimpleRegisterNode = isInmoNode || isAutosNode || isFinanzasNode;
  const loginAccent = getLoginAccent(nodeParam);
  const loginNodoLogoSrc = isFinanzasNode
    ? "/logos/nodo ver.png"
    : isAutosNode
      ? "/logos/nodo roj.png"
      : isClinicaNode
        ? getNodoLogoSrc("clinica")
        : "/logos/nodo nar.png";

  useEffect(() => applyLoginAccent(loginAccent), [loginAccent]);

  // Modes: "login" or "register" (only for clinica-virtual)
  // Modes: "login", "register", "forgot" or "reset-password"
  // authMode is driven by usePasswordRecoveryBootstrap (+ manual toggles below)
  // Register role: "paciente" or "medico"
  const [registerRole, setRegisterRole] = useState<"paciente" | "medico">(
    roleParam === "medico" ? "medico" : "paciente",
  );
  // Doctor Plan: "starter" or "pro"
  const [doctorPlan, setDoctorPlan] = useState<"starter" | "pro">("pro");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameError, setNameError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);

  const {
    authMode,
    setAuthMode,
    bootstrapping: recoveryBootstrapping,
  } = usePasswordRecoveryBootstrap({
    supabase: authSupabase,
    modeParam,
    searchParams,
    initialMode: initialAuthMode,
    onError: (message) => setGeneralError(message),
  });

  useEffect(() => {
    if (recoveryBootstrapping) return;
    if (modeParam === "register") setAuthMode("register");
    else if (modeParam === "login") setAuthMode("login");
    else if (modeParam === "forgot") setAuthMode("forgot");
  }, [modeParam, recoveryBootstrapping, setAuthMode]);

  useEffect(() => {
    if (roleParam === "medico") setRegisterRole("medico");
    else if (roleParam === "paciente") setRegisterRole("paciente");
  }, [roleParam]);

  const [transitionTarget, setTransitionTarget] = useState<{
    label: string;
    code: string;
    Icon: React.ElementType;
    logoSrc?: string;
  } | null>(null);
  const [successModal, setSuccessModal] = useState<{
    open: boolean;
    type: "paciente" | "medico" | "patient_verify" | "forgot_verify" | "reset_success";
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
  const childModules = getChildNodes(cleanSlug);
  const showModulePicker =
    needsModulePicker(nodeParam) &&
    authMode === "login" &&
    !recoveryBootstrapping;

  const registrationOrigin =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? window.location.origin)
      : "http://localhost:3000";

  const urlError = searchParams.get("error");
  const authErrorCode = searchParams.get("auth_error");
  const showResend = searchParams.get("resend") === "1";
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (authErrorCode === AUTH_ERROR_CREDENTIALS) {
      setGeneralError(INVALID_LOGIN_MESSAGE);
      const url = new URL(window.location.href);
      url.searchParams.delete("auth_error");
      router.replace(url.pathname + url.search, { scroll: false });
      return;
    }
    if (urlError && authMode !== "reset-password") {
      setGeneralError(decodeURIComponent(urlError.replace(/\+/g, " ")));
    }
  }, [authErrorCode, urlError, authMode, router]);

  function unitCodeForResend(): string {
    if (isAutosNode) return "Autos";
    if (isFinanzasNode) return "Finanzas";
    if (isInmoNode) return "Inmo";
    if (registerRole === "paciente") return "Salud";
    return "Clínica";
  }

  async function handleResendVerification() {
    if (!email.trim()) {
      setEmailError("Ingresá el correo con el que te registraste.");
      return;
    }
    setResendLoading(true);
    setGeneralError("");
    try {
      const res = await fetch("/api/registration/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          unitCode: unitCodeForResend(),
          origin: registrationOrigin,
        }),
      });
      const json = await res.json();
      if (json.status === "error") {
        setGeneralError(json.message);
      } else {
        setSuccessModal({
          open: true,
          type: "patient_verify",
          message: json.message,
        });
      }
    } catch {
      setGeneralError("No se pudo reenviar el correo. Intentá de nuevo.");
    } finally {
      setResendLoading(false);
    }
  }

  // Set up details for the left panel based on nodeParam
  let activeNodeSlug: string | undefined = undefined;
  let panelTitle = "El núcleo de gestión de su ecosistema.";
  let panelDesc =
    "Panel de administración para gestionar clientes, unidades de negocio y el roadmap del Core.";

  if (nodeParam === "nodo-clinica" || nodeParam === "clinica-virtual") {
    activeNodeSlug = "clinica"; // Connect to Clinica sub-node in diagram
    panelTitle = "NODO | Clínica Virtual";
    panelDesc =
      "Plataforma HealthTech para telemedicina profesional: consultorios virtuales, recetas digitales e informes automatizados con Inteligencia Artificial.";
  } else if (nodeParam === "nodo-autos" || nodeParam === "autos") {
    activeNodeSlug = "autos";
    panelTitle = "NODO | Automotores";
    panelDesc =
      "Panel de gestión de stock para concesionarias y agencias: inventario, clientes, publicaciones y contratos de venta digitales.";
  } else if (matchedNode) {
    activeNodeSlug = matchedNode.slug;
    panelTitle = `NODO | ${matchedNode.code}`;
    panelDesc = matchedNode.description;
  }

  const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  function redirectAfterSession(session: { access_token: string; refresh_token: string }) {
    let tLabel = "Core";
    let tCode = "Core";
    let TIcon: React.ElementType = Layers;

    if (isTiendaNode) {
      tLabel = matchedNode?.label ?? "Nodo Tienda";
      tCode = matchedNode?.code ?? "Tienda";
      TIcon = matchedNode?.Icon ?? Layers;
    } else if (nodeParam === "nodo-inmo" || nodeParam === "inmo") {
      tLabel = matchedNode?.label ?? "Nodo Inmo";
      tCode = matchedNode?.code ?? "Inmo";
      TIcon = matchedNode?.Icon ?? Layers;
    } else if (
      nodeParam === "nodo-clinica" ||
      nodeParam === "clinica-virtual" ||
      nodeParam === "clinica"
    ) {
      tLabel = "Clínica Virtualaaaaa";
      tCode = "Clínica";
      TIcon = matchedNode?.Icon ?? Layers;
    } else if (isAutosNode) {
      tLabel = matchedNode?.label ?? "Nodo Automotores";
      tCode = matchedNode?.code ?? "Autos";
      TIcon = matchedNode?.Icon ?? Layers;
    } else if (isFinanzasNode) {
      tLabel = matchedNode?.label ?? "Nodo Finanzas Personales";
      tCode = matchedNode?.code ?? "Finanzas";
      TIcon = matchedNode?.Icon ?? Layers;
    }

    setTransitionTarget({
      label: tLabel,
      code: tCode,
      Icon: TIcon,
      ...(isFinanzasNode || isAutosNode || isClinicaNode
        ? { logoSrc: loginNodoLogoSrc }
        : {}),
    });

    const { access_token, refresh_token } = session;
    setTimeout(() => {
      if (isTiendaNode) {
        window.location.href = `/tienda/auth/callback#access_token=${access_token}&refresh_token=${refresh_token}`;
      } else if (nodeParam === "nodo-inmo" || nodeParam === "inmo") {
        window.location.href = `/inmo/auth/callback#access_token=${access_token}&refresh_token=${refresh_token}`;
      } else if (
        nodeParam === "nodo-clinica" ||
        nodeParam === "clinica-virtual" ||
        nodeParam === "clinica"
      ) {
        window.location.href = `/clinica/auth/callback#access_token=${access_token}&refresh_token=${refresh_token}`;
      } else if (isAutosNode) {
        window.location.href = `/autos/auth/callback#access_token=${access_token}&refresh_token=${refresh_token}`;
      } else if (isFinanzasNode) {
        redirectToFinanzasAuth(access_token, refresh_token);
      } else {
        router.push("/panel");
      }
    }, 1550);
  }

  async function handleForcedPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setGeneralError("");

    if (password.trim().length < 8) {
      setPasswordError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const { data: sessionData } = await authSupabase!.auth.getSession();
    const res = await fetch("/api/auth/complete-forced-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionData.session?.access_token
          ? { Authorization: `Bearer ${sessionData.session.access_token}` }
          : {}),
      },
      body: JSON.stringify({
        password: password.trim(),
        confirmPassword: confirmPassword.trim(),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setGeneralError(json.error ?? "No se pudo actualizar la contraseña.");
      setLoading(false);
      return;
    }

    const { data: refreshed, error: refreshErr } = await authSupabase.auth.refreshSession();
    if (refreshErr || !refreshed.session) {
      setGeneralError("Contraseña actualizada. Volvé a iniciar sesión.");
      setNeedsNewPassword(false);
      setAuthMode("login");
      setLoading(false);
      return;
    }

    setNeedsNewPassword(false);
    redirectAfterSession(refreshed.session);
    setLoading(false);
  }

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
    const needsPassword =
      authMode === "login" ||
      (authMode === "register" && isClinicaNode && registerRole === "paciente") ||
      (authMode === "register" && isFinanzasNode);

    if (needsPassword) {
      if (authMode === "login" && password.trim().length < 4) {
        setPasswordError("Ingrese su contraseña.");
        valid = false;
      } else if (authMode === "register" && password.trim().length < 6) {
        setPasswordError("La contraseña debe tener al menos 6 caracteres.");
        valid = false;
      }
    }
    if (!valid) return;

    setLoading(true);

    if (authMode === "login") {
      if (!authSupabase) {
        setGeneralError("No se pudo inicializar la autenticación de este nodo.");
        setLoading(false);
        return;
      }
      const supabase = authSupabase;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setGeneralError(INVALID_LOGIN_MESSAGE);
        setLoading(false);
        return;
      }

      // Tienda provisions on first access at the SPA auth callback — skip gate here
      if (matchedNode?.code && !isTiendaNode) {
        const access = await enforceNodeAccess(supabase, matchedNode.code);
        if (!access.ok) {
          setGeneralError(access.message);
          setLoading(false);
          return;
        }
      }

      if (await fetchMustSetPassword(supabase)) {
        setNeedsNewPassword(true);
        setPassword("");
        setConfirmPassword("");
        setLoading(false);
        return;
      }

      redirectAfterSession(data.session!);
      setLoading(false);
      return;
    } else {
      const originUrl = registrationOrigin;

      if (isInmoNode) {
        const result = await submitInmoRegistration(
          fullName,
          email,
          originUrl,
        );

        if (result.status === "error") {
          setGeneralError(result.message);
          setLoading(false);
        } else {
          setGeneralError("");
          setSuccessModal({
            open: true,
            type: "patient_verify",
            message: result.message,
          });
          setLoading(false);
        }
      } else if (isAutosNode || isFinanzasNode) {
        const unitCode = isAutosNode ? "Autos" : "Finanzas";
        const plan = isAutosNode ? "autos" : "finanzas";
        const result = await submitNodeRegistration({
          unitCode,
          fullName,
          email,
          plan,
          origin: originUrl,
          password: isFinanzasNode ? password.trim() : undefined,
        });

        if (result.status === "error") {
          setGeneralError(result.message);
          setLoading(false);
        } else {
          setGeneralError("");
          setSuccessModal({
            open: true,
            type: "patient_verify",
            message: result.message,
          });
          setLoading(false);
        }
      } else if (registerRole === "medico") {
        const result = await submitDoctorRegistration(
          fullName,
          email,
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

  const getOAuthRedirectPath = () => {
    if (isInmoNode) return "/inmo";
    if (isAutosNode) return "/autos";
    if (isFinanzasNode) return "/finanzas/admin/dashboard";
    return "/panel";
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    const supabase = authSupabase;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${getOAuthRedirectPath()}`,
      },
    });
    if (error) {
      setGeneralError(error.message);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const supabase = authSupabase;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${getOAuthRedirectPath()}`,
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
    const originUrl = registrationOrigin;

    const result = await requestPasswordReset(
      email.trim(),
      nodeParam,
      originUrl,
      typeof window !== "undefined" ? window.location.pathname : undefined,
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

  async function handleFirstAccessSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    setPasswordError("");
    setGeneralError("");

    if (!validEmail(email.trim())) {
      setEmailError("Ingrese un correo válido.");
      return;
    }
    if (password.trim().length < 8) {
      setPasswordError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/set-initial-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password: password.trim(),
        nodeSlug: cleanSlug,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setGeneralError(json.error ?? "No se pudo configurar la contraseña.");
      setLoading(false);
      return;
    }

    const supabase = authSupabase;
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error || !data.session) {
      setSuccessModal({
        open: true,
        type: "paciente",
        message: "Contraseña configurada. Ya podés iniciar sesión.",
      });
      setAuthMode("login");
      setLoading(false);
      return;
    }

    // Reuse login redirect logic
    const { access_token, refresh_token } = data.session;
    setLoading(false);
    if (isInmoNode) {
      window.location.href = `/inmo/auth/callback#access_token=${access_token}&refresh_token=${refresh_token}`;
    } else if (isClinicaNode) {
      window.location.href = `/clinica/auth/callback#access_token=${access_token}&refresh_token=${refresh_token}`;
    } else if (isAutosNode) {
      window.location.href = `/autos/auth/callback#access_token=${access_token}&refresh_token=${refresh_token}`;
    } else if (isFinanzasNode) {
      redirectToFinanzasAuth(access_token, refresh_token);
    } else {
      router.push("/panel");
    }
  }

  async function handleResetPassword(newPassword: string): Promise<string | null> {
    const { error } = await authSupabase.auth.updateUser({
      password: newPassword,
    });

    if (error) return error.message;

    await authSupabase.auth.signOut({ scope: "local" });
    setSuccessModal({
      open: true,
      type: "reset_success",
      message:
        "Tu contraseña se restableció correctamente. Ya podés iniciar sesión con tu nueva clave.",
    });
    setAuthMode("login");
    return null;
  }

  const inputBase =
    "w-full text-[15px] py-[11px] px-[14px] rounded-md bg-white border transition-all duration-150 outline-none";
  const inputNormal = "border-mist text-ink";
  const inputError = "border-[#C0392B] shadow-[0_0_0_4px_rgba(192,57,43,.12)]";
  const inputFocus =
    "focus:border-brand focus:shadow-[0_0_0_4px_var(--login-focus-ring)]";

  const simpleRegisterContent = isInmoNode
    ? {
        title: "Registrarse como dueño de inmobiliaria",
        subtitle:
          "Creá tu cuenta para gestionar propiedades, contratos y cobros.",
        emailPlaceholder: "inmobiliaria@ejemplo.com",
        submitLabel: "Crear cuenta de inmobiliaria",
        idPrefix: "reg-inmo",
      }
    : isAutosNode
      ? {
          title: "Registrarse en NODO Automotores",
          subtitle:
            "Creá tu cuenta para administrar stock, clientes y ventas.",
          emailPlaceholder: "concesionaria@ejemplo.com",
          submitLabel: "Crear cuenta",
          idPrefix: "reg-autos",
        }
      : isFinanzasNode
        ? {
            title: "Crear cuenta en Finanzas Personales",
            subtitle:
              "Registrá tus gastos, tarjetas y préstamos en un solo lugar.",
            emailPlaceholder: "tu@email.com",
            submitLabel: "Crear cuenta",
            idPrefix: "reg-finanzas",
          }
        : null;

  const googleIcon = (
    <svg className="w-5 h-5 mr-2.5" viewBox="0 0 24 24" fill="currentColor">
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
  );

  return (
    <>
      {transitionTarget && (
        <NodeTransitionOverlay
          label={transitionTarget.label}
          code={transitionTarget.code}
          Icon={transitionTarget.Icon}
          logoSrc={transitionTarget.logoSrc}
          accent={loginAccent}
        />
      )}

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
        <aside className="login-brand-panel relative overflow-hidden bg-navy-900 text-white px-12 py-10 flex-col min-h-screen hidden">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(70% 50% at 30% 30%, rgba(${loginAccent.rgb},.20), transparent 70%)`,
            }}
          />

          <div className="relative z-[1] shrink-0">
            <Image
              src="/logos/logo compuesto estrella az letra blancazzz.png"
              alt="Nodo Core"
              width={140}
              height={30}
              style={{ height: "30px", width: "auto" }}
            />
          </div>

          <div className="relative z-[1] login-brand-diagram">
            <EcosystemDiagram
              dark
              interactive
              isLoginPage
              activeNodeSlug={activeNodeSlug}
              className="w-[min(480px,96%)] aspect-square mx-auto"
            />
          </div>

          <div className="relative z-[1] shrink-0 login-brand-copy">
            <h2
              className="font-display font-extrabold text-white max-w-[14em]"
              style={{ fontSize: "clamp(26px,2.6vw,34px)", lineHeight: 1.15 }}
            >
              {panelTitle.includes("|") ? (
                <span className="flex items-center gap-[0.3em]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={loginNodoLogoSrc}
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

            <p
              className="mt-8 text-[13px]"
              style={{ color: "rgba(234,240,247,.5)" }}
            >
              © 2026 Nodo Core · Transparencia tecnológica
            </p>
          </div>
        </aside>

        {/* Form panel (right) */}
        <main className="flex items-center justify-center p-8 bg-paper min-h-screen">
          <div className="w-[min(420px,100%)]">
            {/* If node is Clinica Virtual or Inmo, show Iniciar / Registrar toggle */}
            {(isClinicaNode || isSimpleRegisterNode) &&
              !showModulePicker &&
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

            {recoveryBootstrapping ? (
              <div className="text-center py-16">
                <p className="text-slate2 text-[14.5px] font-medium">
                  Validando enlace de recuperación…
                </p>
              </div>
            ) : showModulePicker ? (
              <div>
                <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-brand">
                  ◎ {matchedNode?.label ?? "NODO"}
                </span>

                <h1 className="font-display font-bold text-ink text-[26px] mt-2 mb-1">
                  Elegí tu módulo
                </h1>
                <p className="text-slate2 text-[14.5px] mb-6">
                  {matchedNode?.code ?? "Este nodo"} incluye varios portales.
                  Seleccioná el que querés usar para iniciar sesión.
                </p>

                <div className="flex flex-col gap-3">
                  {childModules.map((mod) => {
                    const modAccent = getLoginAccent(`nodo-${mod.slug}`);
                    const ModIcon = mod.Icon;
                    return (
                      <Link
                        key={mod.slug}
                        href={`/nodo-${mod.slug}/login`}
                        className="group flex items-start gap-4 rounded-xl border border-mist bg-white p-4 transition-all duration-150 hover:border-brand hover:bg-brand/5 hover:shadow-sm"
                        style={{
                          borderLeftWidth: 4,
                          borderLeftColor: modAccent.brand,
                        }}
                      >
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: `rgba(${modAccent.rgb}, 0.12)`,
                            color: modAccent.brand,
                          }}
                        >
                          <ModIcon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-[17px] font-bold text-ink group-hover:text-brand transition-colors">
                            {mod.label}
                          </span>
                          <span className="mt-1 block text-[13.5px] leading-snug text-slate2">
                            {mod.description}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : needsNewPassword ? (
              <form onSubmit={handleForcedPasswordSubmit} noValidate>
                <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-brand">
                  ◎ Nueva contraseña
                </span>
                <h1 className="font-display font-bold text-ink text-[26px] mt-2 mb-1">
                  Definí tu nueva contraseña
                </h1>
                <p className="text-slate2 text-[14.5px] mb-6">
                  Tu acceso fue blanqueado o requiere una clave nueva. Elegí una contraseña y repetila para continuar.
                </p>

                <div className="mb-4">
                  <label htmlFor="forced-pass" className="block text-[13px] font-semibold text-navy mb-1.5">
                    Contraseña
                  </label>
                  <input
                    id="forced-pass"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError("");
                    }}
                    className={`${inputBase} ${passwordError ? inputError : inputNormal} ${inputFocus}`}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>

                <div className="mb-4">
                  <label htmlFor="forced-pass-confirm" className="block text-[13px] font-semibold text-navy mb-1.5">
                    Repetir contraseña
                  </label>
                  <input
                    id="forced-pass-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPasswordError("");
                    }}
                    className={`${inputBase} ${passwordError ? inputError : inputNormal} ${inputFocus}`}
                  />
                  {passwordError && <p className="text-[12.5px] text-[#C0392B] mt-1.5">{passwordError}</p>}
                </div>

                {generalError && (
                  <p className="text-[13px] text-[#C0392B] mb-3 text-center">{generalError}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-md bg-brand text-white font-semibold text-[15px] hover:bg-brand-600 active:scale-[.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? "Guardando…" : "Continuar"}
                </button>
              </form>
            ) : authMode === "login" ? (
              <div>
                {/* Kicker */}
                <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-brand">
                  {isClinicaNode
                    ? "◎ Portal Clínica Virtual"
                    : isInmoNode
                      ? "◎ Portal Inmobiliarias"
                      : isAutosNode
                        ? "◎ Portal Automotores"
                        : isFinanzasNode
                          ? "◎ Portal Finanzas Personales"
                          : "◎ Acceso administradores"}
                </span>

                <h1 className="font-display font-bold text-ink text-[26px] mt-2 mb-1">
                  Iniciar sesión
                </h1>
                <p className="text-slate2 text-[14.5px] mb-6">
                  {isClinicaNode
                    ? "Ingrese sus credenciales de médico o paciente para acceder."
                    : isInmoNode
                      ? "Ingrese sus credenciales de dueño de inmobiliaria para acceder."
                      : isAutosNode
                        ? "Ingrese sus credenciales para acceder al panel de automotores."
                        : isFinanzasNode
                          ? "Ingrese sus credenciales para acceder a finanzas personales."
                          : "Ingrese sus credenciales para acceder al panel de Nodo Core."}
                </p>

                {(isClinicaNode || isSimpleRegisterNode) && (
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
                        placeholder="Ingresé contraseña…"
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
            ) : authMode === "first-access" ? (
              <form onSubmit={handleFirstAccessSubmit} noValidate>
                <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-brand">
                  ◎ Primer acceso
                </span>
                <h1 className="font-display font-bold text-ink text-[26px] mt-2 mb-1">
                  Configurá tu contraseña
                </h1>
                <p className="text-slate2 text-[14.5px] mb-6">
                  Tu cuenta fue habilitada. Creá tu contraseña para ingresar a la aplicación.
                </p>

                <div className="mb-4">
                  <label htmlFor="first-email" className="block text-[13px] font-semibold text-navy mb-1.5">
                    Email
                  </label>
                  <input
                    id="first-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError("");
                    }}
                    className={`${inputBase} ${emailError ? inputError : inputNormal} ${inputFocus}`}
                  />
                  {emailError && <p className="text-[12.5px] text-[#C0392B] mt-1.5">{emailError}</p>}
                </div>

                <div className="mb-4">
                  <label htmlFor="first-pass" className="block text-[13px] font-semibold text-navy mb-1.5">
                    Contraseña
                  </label>
                  <input
                    id="first-pass"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError("");
                    }}
                    className={`${inputBase} ${passwordError ? inputError : inputNormal} ${inputFocus}`}
                    placeholder="Ingresé contraseña…"
                  />
                </div>

                <div className="mb-4">
                  <label htmlFor="first-pass-confirm" className="block text-[13px] font-semibold text-navy mb-1.5">
                    Repetir contraseña
                  </label>
                  <input
                    id="first-pass-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPasswordError("");
                    }}
                    placeholder="Repetí la contraseña…"
                    className={`${inputBase} ${passwordError ? inputError : inputNormal} ${inputFocus}`}
                  />
                  {passwordError && <p className="text-[12.5px] text-[#C0392B] mt-1.5">{passwordError}</p>}
                </div>

                {generalError && (
                  <p className="text-[13px] text-[#C0392B] mb-3 text-center">{generalError}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-md bg-brand text-white font-semibold text-[15px] hover:bg-brand-600 disabled:opacity-60 cursor-pointer"
                >
                  {loading ? "Guardando…" : "Guardar e ingresar"}
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
              <PasswordResetPanel
                nodeLabel={getNodeMailLabel(nodeParam)}
                onResetPassword={handleResetPassword}
              />
            ) : (
              /* Register Mode */
              <div>
                {isSimpleRegisterNode && simpleRegisterContent ? (
                  <div>
                    <div className="text-center">
                      <h2 className="font-display font-bold text-ink text-[22px] mb-2">
                        {simpleRegisterContent.title}
                      </h2>
                      <p className="text-slate2 text-[14px] mb-6">
                        {simpleRegisterContent.subtitle}
                      </p>

                      <button
                        type="button"
                        onClick={handleGoogleRegister}
                        disabled={loading}
                        className="w-full inline-flex items-center justify-center py-3 px-4 rounded-md border border-mist bg-white text-ink text-[14.5px] font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer disabled:opacity-60"
                      >
                        {googleIcon}
                        Registrarse con Google
                      </button>
                    </div>

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

                    <form onSubmit={handleSubmit} noValidate>
                      <div className="mb-3">
                        <label
                          htmlFor={`${simpleRegisterContent.idPrefix}-name`}
                          className="block text-[13px] font-semibold text-navy mb-1.5"
                        >
                          Nombre completo
                        </label>
                        <input
                          id={`${simpleRegisterContent.idPrefix}-name`}
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

                      <div className="mb-3">
                        <label
                          htmlFor={`${simpleRegisterContent.idPrefix}-email`}
                          className="block text-[13px] font-semibold text-navy mb-1.5"
                        >
                          Correo electrónico
                        </label>
                        <input
                          id={`${simpleRegisterContent.idPrefix}-email`}
                          type="email"
                          placeholder={simpleRegisterContent.emailPlaceholder}
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

                      {isFinanzasNode && (
                        <>
                          <div className="mb-3">
                            <label
                              htmlFor={`${simpleRegisterContent.idPrefix}-password`}
                              className="block text-[13px] font-semibold text-navy mb-1.5"
                            >
                              Contraseña
                            </label>
                            <input
                              id={`${simpleRegisterContent.idPrefix}-password`}
                              type="password"
                              placeholder="Ingresé contraseña…"
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                setPasswordError("");
                              }}
                              className={`${inputBase} ${passwordError ? inputError : inputNormal} ${inputFocus}`}
                              autoComplete="new-password"
                            />
                            {passwordError && (
                              <p className="text-[12.5px] text-[#C0392B] mt-1.5">
                                {passwordError}
                              </p>
                            )}
                          </div>
                        </>
                      )}

                      <p className="text-slate2 text-[12px] mb-4 text-center">
                        {isFinanzasNode
                          ? "Te enviaremos un correo para verificar tu email y activar tu cuenta."
                          : "Te enviaremos un correo para verificar tu email. La contraseña la configurás después de la habilitación."}
                      </p>

                      {generalError && (
                        <p className="text-[13px] text-[#C0392B] mb-4 text-center">
                          {generalError}
                        </p>
                      )}

                      {(showResend || generalError.toLowerCase().includes("verific")) && (
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={resendLoading || !email.trim()}
                          className="w-full mb-4 py-2.5 rounded-md border border-brand text-brand text-[13.5px] font-semibold hover:bg-brand/5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {resendLoading ? "Reenviando…" : "Reenviar correo de verificación"}
                        </button>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 rounded-md bg-brand text-white font-semibold text-[15px] hover:bg-brand-600 active:scale-[.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {loading
                          ? "Registrando…"
                          : simpleRegisterContent.submitLabel}
                      </button>
                    </form>
                  </div>
                ) : isClinicaNode ? (
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
                              placeholder="Ingresé contraseña…"
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
                            className="w-full py-3.5 rounded-md bg-brand text-white font-semibold text-[15px] hover:bg-brand-600 active:scale-[.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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
                ) : null}
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
            ) : successModal.type === "reset_success" ? (
              <>
                <div className="h-14 w-14 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-5 border border-brand/20">
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
                <h3 className="font-display font-extrabold text-brand text-[21px] mb-2.5">
                  Contraseña actualizada
                </h3>
                <p className="text-slate2 text-[14px] leading-relaxed mb-6">
                  {successModal.message}
                </p>
                <button
                  onClick={() => {
                    setSuccessModal({
                      open: false,
                      type: "reset_success",
                      message: "",
                    });
                    setAuthMode("login");
                  }}
                  className="w-full py-3 rounded-lg bg-brand text-white font-bold text-[14.5px] hover:bg-brand-600 active:scale-[.98] transition-all cursor-pointer shadow-md shadow-brand/15"
                >
                  Ir al inicio de sesión
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
                      isInmoNode
                        ? "/nodo-inmo"
                        : isAutosNode
                          ? "/nodo-autos"
                          : isFinanzasNode
                            ? "/nodo-finanzas"
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
                <div className="h-14 w-14 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-5 border border-brand/20">
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
                <h3 className="font-display font-extrabold text-brand text-[21px] mb-2.5">
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
                  className="w-full py-3 rounded-lg bg-brand text-white font-bold text-[14.5px] hover:bg-brand-600 active:scale-[.98] transition-all cursor-pointer shadow-md shadow-brand/15"
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
