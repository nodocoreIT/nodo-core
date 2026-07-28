"use client";

import { Smartphone } from "lucide-react";
import { normalizeArMobilePhone } from "@/lib/clinic/phone-utils";

const inputClass =
  "mt-1 w-full rounded-lg px-3 py-2.5 text-sm bg-white border border-slate-200 text-navy placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 transition-shadow disabled:opacity-60 [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_#ffffff] [&:-webkit-autofill]:[-webkit-text-fill-color:#1e293b]";

interface PhoneFieldProps {
  value: string;
  onChange: (value: string) => void;
  onValidChange?: (valid: boolean) => void;
  labelClass?: string;
}

export function PhoneField({
  value,
  onChange,
  onValidChange,
  labelClass = "text-xs font-medium text-slate-300",
}: PhoneFieldProps) {
  const trimmed = value.trim();
  const valid = trimmed !== "" && normalizeArMobilePhone(trimmed) !== null;
  const showError = trimmed !== "" && !valid;

  const handleChange = (next: string) => {
    onChange(next);
    const nextTrimmed = next.trim();
    onValidChange?.(nextTrimmed !== "" && normalizeArMobilePhone(nextTrimmed) !== null);
  };

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
        <input
          id="onboarding-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+5492954223344"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className={inputClass}
        />
        {showError ? (
          <p className="text-rose-400 text-xs mt-1.5">
            Ese formato de celular no es válido.
          </p>
        ) : (
          <p className="text-xs mt-1.5" style={{ color: "rgba(234,240,247,.4)" }}>
            Formato: +54 9 + código de área + número, sin espacios. Ej: +5492954223344
          </p>
        )}
      </div>
    </div>
  );
}
