"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import NeuralNodesBackground from "@/components/NeuralNodesBackground";
import { OnboardingNodeHeader } from "@/components/onboarding/OnboardingNodeHeader";
import { OnboardingPlanSelector } from "@/components/onboarding/OnboardingPlanSelector";
import { CreditCardInput } from "@/components/onboarding/CreditCardInput";
import { DocumentNumberInput } from "@nodocore/shared-components";
import { applyLoginAccent, getNodeAccentBySlug } from "@/lib/node-accents";
import { getNodeBySlug } from "@/lib/nodes";
import type { OnboardingPlanOption } from "@/lib/onboarding/plan-catalog";

const inputClass =
  "mt-1 w-full rounded-lg px-3 py-2.5 text-sm bg-white border border-slate-200 text-navy placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-shadow";

const inputReadOnlyClass =
  "mt-1 w-full rounded-lg px-3 py-2.5 text-sm bg-slate-100 border border-slate-200 text-slate-600 shadow-sm";

const labelClass = "text-xs font-medium text-slate-300";

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
      className="relative w-full border-2 border-dashed border-slate-300 rounded-lg p-4 cursor-pointer hover:border-slate-400 transition-colors h-52 flex items-center justify-center bg-slate-50"
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
          className="w-full h-full object-contain rounded"
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
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [idPhotoFront, setIdPhotoFront] = useState<File | null>(null);
  const [idPhotoBack, setIdPhotoBack] = useState<File | null>(null);
  const [documentNumber, setDocumentNumber] = useState("");
  const [identityVerificationRequired, setIdentityVerificationRequired] = useState(false);
  const [existingUser, setExistingUser] = useState(false);
  const [existingNodeLabels, setExistingNodeLabels] = useState<string[]>([]);
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
          if (data.phone) setPhone(data.phone);
          setNodeSlug(data.nodeSlug ?? "");
          setNodeCode(data.nodeCode ?? "");
          setPlans(Array.isArray(data.plans) ? data.plans : []);
          setExistingUser(Boolean(data.existingUser));
          setExistingNodeLabels(
            Array.isArray(data.existingNodeLabels) ? data.existingNodeLabels : [],
          );
          setIdentityVerificationRequired(
            data.existingUser ? false : Boolean(data.identityVerificationRequired),
          );

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
    formData.append("email", email);
    formData.append("planChoice", planChoice);

    if (!existingUser) {
      formData.append("firstName", firstName);
      formData.append("lastName", lastName);
      formData.append("address", address);
      formData.append("city", city);
      formData.append("province", province);
      formData.append("phone", phone);
      if (documentNumber) formData.append("documentNumber", documentNumber);
      formData.append("cardHolder", cardHolder);
      formData.append("cardNumber", cardNumber);
      formData.append("cardExpiry", cardExpiry);
      formData.append("cardCvc", cardCvc);
      if (idPhotoFront) {
        formData.append("idPhotoFront", idPhotoFront);
      }
      if (idPhotoBack) {
        formData.append("idPhotoBack", idPhotoBack);
      }
    }

    const res = await fetch("/api/onboarding/complete", { method: "POST", body: formData });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? "Error al enviar la solicitud.");
      return;
    }
    setSubmitted(true);
  }

  const existingNodesText =
    existingNodeLabels.length > 0
      ? existingNodeLabels.length === 1
        ? existingNodeLabels[0]
        : `${existingNodeLabels.slice(0, -1).join(", ")} y ${existingNodeLabels.at(-1)}`
      : "otro nodo del ecosistema";

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

  if (error && !email && !nodeSlug && !submitted) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <NeuralNodesBackground />
        <div
          className="relative z-10 mx-auto w-full max-w-md rounded-2xl border p-8 text-center shadow-2xl backdrop-blur-md"
          style={{
            background: "rgba(27, 42, 65, 0.88)",
            borderColor: "rgba(255,255,255,.1)",
          }}
        >
          <p className="text-sm text-red-300">{error}</p>
          <p className="mt-6 text-xs" style={{ color: "rgba(234,240,247,.4)" }}>
            <Link href="/" className="underline hover:text-white">Volver al inicio</Link>
          </p>
        </div>
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
                {existingUser
                  ? "Recibimos la elección de plan. Pronto el equipo de NODO Core habilitará tu nuevo nodo. Usá las mismas credenciales que ya tenés para ingresar."
                  : "Estamos revisando tus datos. Pronto el equipo de NODO Core se contactará con vos para confirmar tu habilitación."}
              </p>
            </>
          ) : existingUser ? (
            <>
              <h1 className="text-2xl font-semibold text-white">Elegí el plan de tu nuevo nodo</h1>
              <p className="text-sm mt-2 max-w-2xl mx-auto" style={{ color: "rgba(234,240,247,.55)" }}>
                Ya tenés una cuenta activa en el ecosistema. Usá las mismas credenciales para acceder.
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

        {!submitted && existingUser && (
          <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto">
            <div
              className="rounded-xl border p-4 md:p-5 text-left space-y-2"
              style={{
                borderColor: `rgba(${accent.rgb}, 0.35)`,
                background: `rgba(${accent.rgb}, 0.1)`,
              }}
            >
              <p className="text-sm font-medium text-white">
                Ya tenés un nodo activo
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(234,240,247,.7)" }}>
                Detectamos que ya usás {existingNodesText}. Para este nuevo nodo{" "}
                <strong className="text-white font-medium">usá el mismo email y contraseña</strong>{" "}
                con los que ya ingresás. Solo necesitamos que elijas el plan contratado.
              </p>
              {email ? (
                <p className="text-xs pt-1" style={{ color: "rgba(234,240,247,.45)" }}>
                  Cuenta: <span className="text-slate-200">{email}</span>
                </p>
              ) : null}
            </div>

            <fieldset>
              <span className={labelClass}>Plan del nuevo nodo</span>
              <OnboardingPlanSelector
                plans={plans}
                value={planChoice}
                onChange={setPlanChoice}
                accent={accent}
              />
            </fieldset>

            {error && (
              <p className="text-sm text-red-300 bg-red-950/40 border border-red-400/30 rounded-lg px-4 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitDisabled || !planChoice}
              className="w-full rounded-lg py-3.5 text-sm font-semibold disabled:opacity-50 hover:opacity-95 transition-opacity"
              style={{ background: accent.brand, color: "var(--color-brand-on, #ffffff)" }}
            >
              {loading ? "Enviando…" : "Confirmar plan"}
            </button>
          </form>
        )}

        {!submitted && !existingUser && (
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <label className="block">
                    <span className={labelClass}>Número de DNI (opcional)</span>
                    <DocumentNumberInput
                      className={inputClass}
                      documentType="DNI"
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                    />
                  </label>

                  <div className="space-y-3">
                    <div>
                      <span className={labelClass}>Frente del DNI *</span>
                      <DniPhotoSlot label="DNI Frente" file={idPhotoFront} onChange={setIdPhotoFront} />
                    </div>
                    <div>
                      <span className={labelClass}>Dorso del DNI *</span>
                      <DniPhotoSlot label="DNI Dorso" file={idPhotoBack} onChange={setIdPhotoBack} />
                    </div>
                  </div>
                </div>
              )}

              {!identityVerificationRequired && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 md:p-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Documento de identidad</p>
                  <div className="space-y-3">
                    <div>
                      <span className={labelClass}>Frente del DNI *</span>
                      <DniPhotoSlot label="DNI Frente" file={idPhotoFront} onChange={setIdPhotoFront} />
                    </div>
                    <div>
                      <span className={labelClass}>Dorso del DNI *</span>
                      <DniPhotoSlot label="DNI Dorso" file={idPhotoBack} onChange={setIdPhotoBack} />
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-white/5 p-4 md:p-5 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Tarjeta para débito (opcional)
                </p>
                <CreditCardInput
                  cardNumber={cardNumber}
                  onCardNumberChange={setCardNumber}
                  cardHolder={cardHolder}
                  onCardHolderChange={setCardHolder}
                  cardExpiry={cardExpiry}
                  onCardExpiryChange={setCardExpiry}
                  cardCvc={cardCvc}
                  onCardCvcChange={setCardCvc}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-300 bg-red-950/40 border border-red-400/30 rounded-lg px-4 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitDisabled || !planChoice}
              className="w-full rounded-lg py-3.5 text-sm font-semibold disabled:opacity-50 hover:opacity-95 transition-opacity"
              style={{ background: accent.brand, color: "var(--color-brand-on, #ffffff)" }}
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
