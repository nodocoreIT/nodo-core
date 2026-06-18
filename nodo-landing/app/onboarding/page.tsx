"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import NeuralNodesBackground from "@/components/NeuralNodesBackground";

const inputClass =
  "mt-1 w-full rounded-lg px-3 py-2.5 text-sm bg-white border border-slate-200 text-navy placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-shadow";

const inputReadOnlyClass =
  "mt-1 w-full rounded-lg px-3 py-2.5 text-sm bg-slate-100 border border-slate-200 text-slate-600 shadow-sm";

const labelClass = "text-xs font-medium text-slate-300";

const fileInputClass =
  "mt-1 w-full rounded-lg bg-white px-3 py-2 text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white";

function OnboardingForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [phone, setPhone] = useState("");
  const [planChoice, setPlanChoice] = useState<"starter" | "pro" | "demo">("starter");
  const [demoDays, setDemoDays] = useState("14");
  const [cardHolder, setCardHolder] = useState("");
  const [cardLastFour, setCardLastFour] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [holdingIdPhoto, setHoldingIdPhoto] = useState<File | null>(null);
  const [cardPhoto, setCardPhoto] = useState<File | null>(null);
  const [documentNumber, setDocumentNumber] = useState("");
  const [identityVerificationRequired, setIdentityVerificationRequired] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [identityMessage, setIdentityMessage] = useState("");
  const [identityStatus, setIdentityStatus] = useState<"idle" | "approved" | "review" | "declined">("idle");
  const [verifyingIdentity, setVerifyingIdentity] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("Enlace de onboarding inválido.");
      setValidating(false);
      return;
    }
    fetch(`/api/onboarding/validate?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setError(data.error ?? "Enlace inválido o expirado.");
        } else {
          setEmail(data.email ?? "");
          setFirstName(data.firstName ?? "");
          setLastName(data.lastName ?? "");
          setIdentityVerificationRequired(Boolean(data.identityVerificationRequired));
        }
        setValidating(false);
      })
      .catch(() => {
        setError("No se pudo validar el enlace.");
        setValidating(false);
      });
  }, [token]);

  function resetIdentityCheck() {
    setIdentityVerified(false);
    setIdentityMessage("");
    setIdentityStatus("idle");
  }

  async function handleVerifyIdentity() {
    if (!token) return;
    if (!holdingIdPhoto || !firstName.trim() || !lastName.trim()) {
      setError("Completá nombre, apellido y subí la foto con tu DNI junto al rostro.");
      return;
    }

    setVerifyingIdentity(true);
    setError("");
    setIdentityMessage("");

    const formData = new FormData();
    formData.append("token", token);
    formData.append("firstName", firstName);
    formData.append("lastName", lastName);
    if (documentNumber) formData.append("documentNumber", documentNumber);
    formData.append("holdingIdPhoto", holdingIdPhoto);

    const res = await fetch("/api/onboarding/verify-identity", { method: "POST", body: formData });
    const json = await res.json();
    setVerifyingIdentity(false);

    if (json.status === "approved" || json.status === "review") {
      setIdentityVerified(true);
      setIdentityStatus(json.status);
      setIdentityMessage(json.message ?? "Verificación registrada.");
      return;
    }

    setIdentityVerified(false);
    setIdentityStatus("declined");
    setIdentityMessage(json.message ?? json.error ?? "No se pudo verificar la identidad.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || submitted) return;
    setLoading(true);
    setError("");

    if (identityVerificationRequired && !identityVerified) {
      setError("Verificá tu identidad antes de enviar la solicitud.");
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("token", token);
    formData.append("firstName", firstName);
    formData.append("lastName", lastName);
    formData.append("email", email);
    formData.append("address", address);
    formData.append("city", city);
    formData.append("province", province);
    formData.append("phone", phone);
    formData.append("planChoice", planChoice);
    if (documentNumber) formData.append("documentNumber", documentNumber);
    if (identityVerificationRequired) formData.append("identityVerified", "true");
    if (planChoice === "demo") formData.append("demoDays", demoDays);
    formData.append("cardHolder", cardHolder);
    formData.append("cardLastFour", cardLastFour);
    formData.append("cardExpiry", cardExpiry);
    if (identityVerificationRequired && holdingIdPhoto) {
      formData.append("holdingIdPhoto", holdingIdPhoto);
    } else if (idPhoto) {
      formData.append("idPhoto", idPhoto);
    }
    if (cardPhoto) formData.append("cardPhoto", cardPhoto);

    const res = await fetch("/api/onboarding/complete", { method: "POST", body: formData });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? "Error al enviar la solicitud.");
      return;
    }
    setSubmitted(true);
  }

  const submitDisabled =
    loading ||
    !token ||
    (identityVerificationRequired && !identityVerified);

  if (validating) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <NeuralNodesBackground />
        <p className="relative z-10 text-white text-sm">Validando enlace…</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen px-4 py-10 md:py-12">
      <NeuralNodesBackground />

      <div
        className="relative z-10 mx-auto w-full max-w-5xl rounded-2xl border p-6 md:p-10 shadow-2xl backdrop-blur-md"
        style={{
          background: "rgba(27, 42, 65, 0.88)",
          borderColor: "rgba(255,255,255,.1)",
          boxShadow: "0 24px 80px rgba(0,0,0,.35)",
        }}
      >
        <div className="text-center mb-8">
          <Image
            src="/logos/logo compuesto.png"
            alt="NODO Core"
            height={30}
            width={140}
            className="mx-auto mb-4 h-[30px] w-auto"
          />
          {submitted ? (
            <>
              <h1 className="text-2xl font-semibold text-white">Solicitud enviada</h1>
              <p className="text-sm mt-3 leading-relaxed max-w-lg mx-auto" style={{ color: "rgba(234,240,247,.65)" }}>
                Estamos revisando tus datos. Pronto el equipo de NODO Core se contactará con vos
                para confirmar tu habilitación.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-white">Completá tu registro</h1>
              <p className="text-sm mt-2 max-w-2xl mx-auto" style={{ color: "rgba(234,240,247,.55)" }}>
                Datos personales, documentación y método de pago. La contraseña la configurás al
                primer ingreso, una vez habilitada tu cuenta.
              </p>
            </>
          )}
        </div>

        {!submitted && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <label className="block">
                <span className={labelClass}>Nombre</span>
                <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Apellido</span>
                <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Teléfono</span>
                <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
              </label>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <label className="block lg:col-span-2">
                <span className={labelClass}>Email</span>
                <input required type="email" value={email} readOnly className={inputReadOnlyClass} />
              </label>
              <fieldset>
                <span className={labelClass}>Plan</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(["starter", "pro", "demo"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlanChoice(p)}
                      className="rounded-lg px-3 py-2 text-sm border font-medium transition-colors"
                      style={{
                        borderColor: planChoice === p ? "#DA5A0E" : "rgba(255,255,255,.2)",
                        background: planChoice === p ? "rgba(218,90,14,.25)" : "rgba(255,255,255,.06)",
                        color: planChoice === p ? "#fff" : "rgba(234,240,247,.75)",
                      }}
                    >
                      {p === "starter" ? "Starter" : p === "pro" ? "Pro" : "Demo"}
                    </button>
                  ))}
                </div>
                {planChoice === "demo" && (
                  <input type="number" min={7} max={90} value={demoDays} onChange={(e) => setDemoDays(e.target.value)} className={`${inputClass} mt-2`} placeholder="Días de demo" />
                )}
              </fieldset>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="block sm:col-span-1">
                <span className={labelClass}>Dirección</span>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Ciudad</span>
                <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Provincia</span>
                <input value={province} onChange={(e) => setProvince(e.target.value)} className={inputClass} />
              </label>
            </div>

            {identityVerificationRequired && (
              <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 md:p-5 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#F0A877" }}>
                    Verificación de identidad
                  </p>
                  <p className="text-xs mt-1" style={{ color: "rgba(234,240,247,.55)" }}>
                    Sacate una foto sosteniendo tu DNI al lado del rostro. Opcionalmente comparamos
                    automáticamente si la persona coincide con la foto del documento (IA).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className={labelClass}>Número de DNI (opcional)</span>
                    <input
                      inputMode="numeric"
                      maxLength={8}
                      value={documentNumber}
                      onChange={(e) => {
                        setDocumentNumber(e.target.value.replace(/\D/g, ""));
                        resetIdentityCheck();
                      }}
                      className={inputClass}
                      placeholder="12345678"
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Foto con DNI junto al rostro</span>
                    <input
                      required
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={(e) => {
                        setHoldingIdPhoto(e.target.files?.[0] ?? null);
                        resetIdentityCheck();
                      }}
                      className={fileInputClass}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleVerifyIdentity}
                    disabled={verifyingIdentity || !holdingIdPhoto}
                    className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "#1B2A41" }}
                  >
                    {verifyingIdentity ? "Verificando…" : "Verificar identidad"}
                  </button>
                  {identityStatus === "approved" && (
                    <span className="text-xs font-medium text-emerald-300">✓ Coincidencia detectada</span>
                  )}
                  {identityStatus === "review" && (
                    <span className="text-xs font-medium text-amber-300">⚠ Revisión manual</span>
                  )}
                  {identityStatus === "declined" && (
                    <span className="text-xs font-medium text-red-300">✗ No verificada</span>
                  )}
                </div>

                {identityMessage && (
                  <p className="text-xs rounded-lg px-3 py-2" style={{ color: "rgba(234,240,247,.75)", background: "rgba(255,255,255,.06)" }}>
                    {identityMessage}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Documentación</p>
                {!identityVerificationRequired && (
                  <label className="block">
                    <span className={labelClass}>Foto del documento (ID)</span>
                    <input required type="file" accept="image/*,.pdf" onChange={(e) => setIdPhoto(e.target.files?.[0] ?? null)} className={fileInputClass} />
                  </label>
                )}
                <label className="block">
                  <span className={labelClass}>Foto de tarjeta (opcional)</span>
                  <input type="file" accept="image/*,.pdf" onChange={(e) => setCardPhoto(e.target.files?.[0] ?? null)} className={`${fileInputClass} file:bg-slate-200! file:text-navy!`} />
                </label>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Tarjeta para débito</p>
                <label className="block">
                  <span className={labelClass}>Titular</span>
                  <input required value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} className={inputClass} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className={labelClass}>Últimos 4 dígitos</span>
                    <input required maxLength={4} value={cardLastFour} onChange={(e) => setCardLastFour(e.target.value.replace(/\D/g, ""))} className={inputClass} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Vencimiento (MM/AA)</span>
                    <input required placeholder="12/28" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} className={inputClass} />
                  </label>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-300 bg-red-950/40 border border-red-400/30 rounded-lg px-4 py-2.5">{error}</p>
            )}

            <button type="submit" disabled={submitDisabled} className="w-full rounded-lg py-3.5 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-95 transition-opacity" style={{ background: "#DA5A0E" }}>
              {loading ? "Enviando…" : "Confirmar y solicitar habilitación"}
            </button>
            {identityVerificationRequired && !identityVerified && (
              <p className="text-center text-xs" style={{ color: "rgba(234,240,247,.45)" }}>
                Primero verificá tu identidad para habilitar el envío.
              </p>
            )}
          </form>
        )}

        <p className="mt-6 text-center text-xs" style={{ color: "rgba(234,240,247,.4)" }}>
          <Link href="/" className="underline hover:text-white">Volver al inicio</Link>
        </p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingForm />
    </Suspense>
  );
}
