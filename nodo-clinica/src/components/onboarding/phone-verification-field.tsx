"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";

const inputClass =
  "mt-1 w-full rounded-lg px-3 py-2.5 text-sm bg-white border border-slate-200 text-navy placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 transition-shadow disabled:opacity-60 [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_#ffffff] [&:-webkit-autofill]:[-webkit-text-fill-color:#1e293b]";

interface PhoneVerificationFieldProps {
  onboardingToken: string;
  labelClass?: string;
  onVerifiedChange?: (verified: boolean) => void;
  onSkipChange?: (skipped: boolean) => void;
}

export function PhoneVerificationField({
  onboardingToken,
  labelClass = "text-xs font-medium text-slate-300",
  onVerifiedChange,
  onSkipChange,
}: PhoneVerificationFieldProps) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const handleSendCode = async () => {
    if (!phone.trim()) {
      toast.error("Ingresá tu número de celular.");
      return;
    }
    setSending(true);
    try {
      const result = await clinicApi.sendOnboardingPhoneCode({
        token: onboardingToken,
        phone: phone.trim(),
      });
      setCodeSent(true);
      if (result.mock && result.devCode) {
        toast.message("Modo desarrollo: código SMS", {
          description: `Usá ${result.devCode} para verificar (Twilio no configurado).`,
          duration: 15000,
        });
      } else {
        toast.success("Te enviamos un SMS con el código de verificación.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el código");
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      toast.error("Ingresá el código de 6 dígitos.");
      return;
    }
    setVerifying(true);
    try {
      const result = await clinicApi.verifyOnboardingPhoneCode({
        token: onboardingToken,
        phone: phone.trim(),
        code: code.trim(),
      });
      setVerified(true);
      setVerifiedPhone(result.phoneE164);
      onVerifiedChange?.(true);
      toast.success("Número verificado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código inválido");
    } finally {
      setVerifying(false);
    }
  };

  if (verified) {
    return (
      <div className="rounded-xl border border-teal-500/40 bg-teal-500/10 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-teal-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-teal-300">Número verificado</p>
          <p className="text-xs text-slate-300 mt-0.5">{verifiedPhone ?? phone}</p>
        </div>
      </div>
    );
  }

  if (skipped) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
        <p className="text-xs text-slate-300">
          Verificación de celular omitida. Podés completar el registro y cargar el número más adelante.
        </p>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={skipped}
            onChange={(e) => {
              const next = e.target.checked;
              setSkipped(next);
              onSkipChange?.(next);
              if (!next) onVerifiedChange?.(false);
            }}
            className="mt-0.5 h-4 w-4 rounded border-white/30 accent-teal-500"
          />
          <span className="text-xs text-slate-300">
            Omitir este campo por ahora (sin verificación SMS)
          </span>
        </label>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-teal-400" />
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          Celular
        </p>
      </div>

      <div>
        <label htmlFor="onboarding-phone" className={labelClass}>
          Número de celular
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="onboarding-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+5492954223344"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setCodeSent(false);
              onVerifiedChange?.(false);
            }}
            className={`${inputClass} flex-1`}
            disabled={sending || verifying}
          />
          <button
            type="button"
            onClick={() => void handleSendCode()}
            disabled={sending || !phone.trim()}
            className="shrink-0 rounded-lg px-3 py-2.5 text-xs font-semibold bg-white/10 text-white border border-white/20 hover:bg-white/15 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : codeSent ? "Reenviar" : "Enviar código"}
          </button>
        </div>
        <p className="text-xs mt-1.5" style={{ color: "rgba(234,240,247,.4)" }}>
          Te llegará un SMS con un código de 6 dígitos para confirmar el número.
        </p>
      </div>

      {codeSent && (
        <div>
          <label htmlFor="onboarding-phone-code" className={labelClass}>
            Código SMS
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="onboarding-phone-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={`${inputClass} flex-1 tracking-widest`}
              disabled={verifying}
            />
            <button
              type="button"
              onClick={() => void handleVerifyCode()}
              disabled={verifying || code.length < 6}
              className="shrink-0 rounded-lg px-3 py-2.5 text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
            </button>
          </div>
        </div>
      )}

      <label className="flex items-start gap-2 cursor-pointer pt-1 border-t border-white/10">
        <input
          type="checkbox"
          checked={skipped}
          onChange={(e) => {
            const next = e.target.checked;
            setSkipped(next);
            onSkipChange?.(next);
            if (next) {
              setCodeSent(false);
              onVerifiedChange?.(false);
            }
          }}
          className="mt-0.5 h-4 w-4 rounded border-white/30 accent-teal-500"
        />
        <span className="text-xs text-slate-300">
          Omitir este campo por ahora (continuar sin verificar el celular)
        </span>
      </label>
    </div>
  );
}
