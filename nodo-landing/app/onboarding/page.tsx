"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import NeuralNodesBackground from "@/components/NeuralNodesBackground";
import { OnboardingNodeHeader } from "@/components/onboarding/OnboardingNodeHeader";
import { OnboardingPlanSelector } from "@/components/onboarding/OnboardingPlanSelector";
import { DocumentNumberInput } from "@nodocore/shared-components";
import { applyLoginAccent, getNodeAccentBySlug } from "@/lib/node-accents";
import { getNodeBySlug } from "@/lib/nodes";
import type { OnboardingPlanOption } from "@/lib/onboarding/plan-catalog";

const inputClass =
  "mt-1 w-full rounded-lg px-3 py-2.5 text-sm bg-white border border-slate-200 text-navy placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-shadow";

const inputReadOnlyClass =
  "mt-1 w-full rounded-lg px-3 py-2.5 text-sm bg-slate-100 border border-slate-200 text-slate-600 shadow-sm";

const labelClass = "text-xs font-medium text-slate-300";

function formatCardExpiryMmAa(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

const fileInputClass =
  "mt-1 w-full rounded-lg bg-white px-3 py-2 text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-navy";

function DniPhotoSlot({
  label,
  file,
  onChange,
}: {
  label: "DNI Frente" | "DNI Dorso";
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      className="relative w-full border-2 border-dashed border-slate-300 rounded-lg p-6 cursor-pointer hover:border-slate-400 transition-colors aspect-video flex items-center justify-center bg-slate-50"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        hidden
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />

      {file ? (
        <img
          src={URL.createObjectURL(file)}
          alt={label}
          className="w-full h-full object-cover rounded"
        />
      ) : (
        <div className="text-center">
          <svg
            className="w-12 h-12 mx-auto mb-2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-xs font-medium text-slate-600">Agregar foto</p>
          <p className="text-xs text-slate-500 mt-1">{label}</p>
        </div>
      )}
    </div>
  );
}

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
  const [planChoice, setPlanChoice] = useState("");
  const [nodeSlug, setNodeSlug] = useState("");
  const [nodeCode, setNodeCode] = useState("");
  const [plans, setPlans] = useState<OnboardingPlanOption[]>([]);
  const [cardHolder, setCardHolder] = useState("");
  const [cardLastFour, setCardLastFour] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardPhoto, setCardPhoto] = useState<File | null>(null);
  const [idPhotoFront, setIdPhotoFront] = useState<File | null>(null);
  const [idPhotoBack, setIdPhotoBack] = useState<File | null>(null);
  const [documentNumber, setDocumentNumber] = useState("");
  const [identityVerificationRequired, setIdentityVerificationRequired] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validating, setValidating] = useState(true);

  const nodeDef = nodeSlug ? getNodeBySlug(nodeSlug) : undefined;
  const accent = getNodeAccentBySlug(nodeSlug || "inmo");

  useEffect(() => {
    if (!nodeSlug) return;
    return applyLoginAccent(accent);
  }, [nodeSlug, accent]);

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
          setNodeSlug(data.nodeSlug ?? "");
          setNodeCode(data.nodeCode ?? "");
          setPlans(Array.isArray(data.plans) ? data.plans : []);
          setIdentityVerificationRequired(Boolean(data.identityVerificationRequired));

          const catalogPlans: OnboardingPlanOption[] = Array.isArray(data.plans) ? data.plans : [];
          const initialPlan =
            catalogPlans.find((plan) => plan.code === data.plan)?.code ??
            catalogPlans[0]?.code ??
            data.plan ??
            "starter";
          setPlanChoice(initialPlan);
        }
        setValidating(false);
      })
      .catch(() => {
        setError("No se pudo validar el enlace.");
        setValidating(false);
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || submitted) return;
    setLoading(true);
    setError("");

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
    formData.append("cardHolder", cardHolder);
    formData.append("cardLastFour", cardLastFour);
    formData.append("cardExpiry", cardExpiry);
    if (idPhotoFront) {
      formData.append("idPhotoFront", idPhotoFront);
    }
    if (idPhotoBack) {
      formData.append("idPhotoBack", idPhotoBack);
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
    !token;

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
          {nodeCode && nodeSlug ? (
            <OnboardingNodeHeader
              nodeCode={nodeCode}
              wordmarkSlug={nodeSlug}
              Icon={nodeDef?.Icon}
              accent={accent}
            />
          ) : null}
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
              <fieldset className="lg:col-span-1">
                <span className={labelClass}>Plan</span>
                <OnboardingPlanSelector
                  plans={plans}
                  value={planChoice}
                  onChange={setPlanChoice}
                  accent={accent}
                />
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
              <div
                className="rounded-xl border p-4 md:p-5 space-y-4"
                style={{
                  borderColor: `rgba(${accent.rgb}, 0.3)`,
                  background: `rgba(${accent.rgb}, 0.08)`,
                }}
              >
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: accent.brand300 }}
                  >
                    Documento de identidad
                  </p>
                  <p className="text-xs mt-1" style={{ color: "rgba(234,240,247,.55)" }}>
                    Subí una foto clara del frente y dorso de tu DNI.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className={labelClass}>Número de DNI (opcional)</span>
                    <DocumentNumberInput
                      className={inputClass}
                      documentType="DNI"
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className={labelClass}>Frente del DNI *</span>
                    <DniPhotoSlot label="DNI Frente" file={idPhotoFront} onChange={setIdPhotoFront} />
                  </div>
                  <div>
                    <span className={labelClass}>Dorso del DNI (opcional)</span>
                    <DniPhotoSlot label="DNI Dorso" file={idPhotoBack} onChange={setIdPhotoBack} />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                {!identityVerificationRequired && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Documento de identidad</p>
                    <div className="space-y-3">
                      <div>
                        <span className={labelClass}>Frente del DNI *</span>
                        <DniPhotoSlot label="DNI Frente" file={idPhotoFront} onChange={setIdPhotoFront} />
                      </div>
                      <div>
                        <span className={labelClass}>Dorso del DNI (opcional)</span>
                        <DniPhotoSlot label="DNI Dorso" file={idPhotoBack} onChange={setIdPhotoBack} />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300 mb-3">Foto de tarjeta (opcional)</p>
                  <label className="block">
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setCardPhoto(e.target.files?.[0] ?? null)} className={fileInputClass} />
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Tarjeta para débito (opcional)</p>
                <label className="block">
                  <span className={labelClass}>Titular</span>
                  <input value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} className={inputClass} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className={labelClass}>Últimos 4 dígitos</span>
                    <input maxLength={4} value={cardLastFour} onChange={(e) => setCardLastFour(e.target.value.replace(/\D/g, ""))} className={inputClass} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Vencimiento (MM/AA)</span>
                    <input
                      placeholder="12/28"
                      inputMode="numeric"
                      maxLength={5}
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatCardExpiryMmAa(e.target.value))}
                      className={inputClass}
                    />
                  </label>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-300 bg-red-950/40 border border-red-400/30 rounded-lg px-4 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitDisabled || !planChoice}
              className="w-full rounded-lg py-3.5 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-95 transition-opacity"
              style={{ background: accent.brand }}
            >
              {loading ? "Enviando…" : "Confirmar y solicitar habilitación"}
            </button>
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
