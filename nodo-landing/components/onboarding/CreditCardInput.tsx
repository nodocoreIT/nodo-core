"use client";

import { useState } from "react";

const inputClass =
  "mt-1 w-full rounded-lg px-3 py-2.5 text-sm bg-white border border-slate-200 text-navy placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-shadow";

const labelClass = "text-xs font-medium text-slate-300";

function formatCardExpiryMmAa(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function ChipIcon() {
  return (
    <svg width="42" height="32" viewBox="0 0 42 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="42" height="32" rx="5" fill="#D4A843" />
      <rect x="14" y="0" width="14" height="32" fill="#C49530" />
      <rect x="0" y="10" width="42" height="12" fill="#C49530" />
      <rect x="14" y="10" width="14" height="12" fill="#B8861A" />
      <rect x="18" y="10" width="6" height="12" fill="#D4A843" opacity="0.6" />
    </svg>
  );
}

function ContactlessIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3C7.03 3 3 7.03 3 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <path d="M12 6.5C8.97 6.5 6.5 8.97 6.5 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M12 10C10.9 10 10 10.9 10 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
      <circle cx="12" cy="12" r="1.5" fill="white" />
    </svg>
  );
}

interface CreditCardInputProps {
  cardNumber: string;
  onCardNumberChange: (value: string) => void;
  cardHolder: string;
  onCardHolderChange: (value: string) => void;
  cardExpiry: string;
  onCardExpiryChange: (value: string) => void;
  cardCvc: string;
  onCardCvcChange: (value: string) => void;
}

export function CreditCardInput({
  cardNumber,
  onCardNumberChange,
  cardHolder,
  onCardHolderChange,
  cardExpiry,
  onCardExpiryChange,
  cardCvc,
  onCardCvcChange,
}: CreditCardInputProps) {
  const [cvcFocused, setCvcFocused] = useState(false);

  // Display values
  const displayNumber = cardNumber
    ? formatCardNumber(cardNumber).padEnd(19, " ").replace(/ /g, "\u00A0")
    : null;

  const groups = ["••••", "••••", "••••", "••••"];
  if (cardNumber) {
    const formatted = formatCardNumber(cardNumber);
    const parts = formatted.split(" ");
    for (let i = 0; i < parts.length; i++) {
      groups[i] = parts[i];
    }
  }

  const displayHolder = cardHolder || "NOMBRE APELLIDO";
  const displayExpiry = cardExpiry || "MM/AA";

  return (
    <div className="space-y-5">
      {/* Card visual */}
      <div className="w-full" style={{ perspective: "1000px" }}>
        <div
          className="relative w-full transition-transform duration-700"
          style={{
            aspectRatio: "1.586 / 1",
            transformStyle: "preserve-3d",
            transform: cvcFocused ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front face */}
          <div
            className="absolute inset-0 rounded-2xl overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              background:
                "linear-gradient(135deg, rgba(30,41,82,0.95) 0%, rgba(55,30,90,0.92) 50%, rgba(20,50,90,0.90) 100%)",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {/* Gloss overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.07) 0%, transparent 60%)",
              }}
            />

            <div className="relative h-full flex flex-col justify-between p-5 md:p-6">
              {/* Top row: logo + contactless */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 opacity-90" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 opacity-90 -ml-1.5" />
                </div>
                <ContactlessIcon />
              </div>

              {/* Chip */}
              <div className="mt-3">
                <ChipIcon />
              </div>

              {/* Card number */}
              <div className="mt-auto">
                <div className="flex gap-3 md:gap-4 font-mono text-white tracking-widest"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
                  {groups.map((g, i) => (
                    <span
                      key={i}
                      className="text-sm md:text-base lg:text-lg font-bold"
                      style={{ letterSpacing: "0.2em" }}
                    >
                      {g}
                    </span>
                  ))}
                </div>

                {/* Name + expiry row */}
                <div className="flex items-end justify-between mt-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-white/40 mb-0.5">
                      Titular
                    </p>
                    <p
                      className="text-xs md:text-sm font-semibold text-white truncate max-w-[160px] uppercase tracking-wider"
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
                    >
                      {displayHolder}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-widest text-white/40 mb-0.5">
                      Vence
                    </p>
                    <p
                      className="text-xs md:text-sm font-semibold text-white font-mono tracking-wider"
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
                    >
                      {displayExpiry}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Back face */}
          <div
            className="absolute inset-0 rounded-2xl overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background:
                "linear-gradient(135deg, rgba(20,30,60,0.97) 0%, rgba(40,20,70,0.95) 50%, rgba(15,40,70,0.95) 100%)",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {/* Gloss overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.04) 0%, transparent 60%)",
              }}
            />

            <div className="relative h-full flex flex-col">
              {/* Magnetic stripe */}
              <div
                className="w-full mt-6"
                style={{
                  height: "14%",
                  background: "linear-gradient(180deg, #1a1a1a 0%, #111 50%, #1a1a1a 100%)",
                }}
              />

              {/* Signature strip + CVC */}
              <div className="flex items-center gap-3 px-5 md:px-6 mt-4">
                <div
                  className="flex-1 h-10 rounded flex items-center px-2"
                  style={{
                    background:
                      "repeating-linear-gradient(90deg, #f5f0e8 0px, #f5f0e8 5px, #e8e0d0 5px, #e8e0d0 6px)",
                  }}
                >
                  <span
                    className="text-xs text-slate-400 italic font-serif truncate"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {cardHolder ? cardHolder.toLowerCase() : "firma del titular"}
                  </span>
                </div>
                <div
                  className="flex flex-col items-center justify-center rounded px-3 h-10 min-w-[56px]"
                  style={{ background: "rgba(255,255,255,0.95)" }}
                >
                  <p className="text-[8px] text-slate-500 uppercase tracking-widest leading-none mb-0.5">
                    CVC
                  </p>
                  <p className="text-sm font-bold text-slate-800 font-mono tracking-widest">
                    {cardCvc || "•••"}
                  </p>
                </div>
              </div>

              {/* Bottom text */}
              <div className="px-5 md:px-6 mt-auto pb-4">
                <p className="text-[9px] text-white/25 leading-relaxed">
                  Esta tarjeta es propiedad del emisor. Su uso está sujeto a los términos del contrato.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Input fields */}
      <div className="space-y-3">
        <label className="block">
          <span className={labelClass}>Número de tarjeta</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0000 0000 0000 0000"
            maxLength={19}
            value={formatCardNumber(cardNumber)}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
              onCardNumberChange(raw);
            }}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Nombre del titular</span>
          <input
            type="text"
            placeholder="Como figura en la tarjeta"
            value={cardHolder}
            onChange={(e) => onCardHolderChange(e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>Vencimiento (MM/AA)</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="12/28"
              maxLength={5}
              value={cardExpiry}
              onChange={(e) => onCardExpiryChange(formatCardExpiryMmAa(e.target.value))}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Código de seguridad (CVC)</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="•••"
              maxLength={4}
              value={cardCvc}
              onChange={(e) => onCardCvcChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onFocus={() => setCvcFocused(true)}
              onBlur={() => setCvcFocused(false)}
              className={inputClass}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
