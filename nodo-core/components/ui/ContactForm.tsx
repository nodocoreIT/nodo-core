"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitContactForm, type ContactFormState } from "@/app/actions";

const initialState: ContactFormState = { status: "idle", message: "" };

const inputClass =
  "w-full px-4 py-3 rounded-md text-white placeholder:text-white/40 text-[15px] outline-none transition-all duration-150";

const inputStyle = {
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.16)",
};

const inputFocusClass = "focus:ring-[4px]";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3.5 rounded-md bg-brand text-white font-semibold text-[16px] hover:bg-brand-600 active:scale-[.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
    >
      {pending ? "Enviando…" : "Enviar consulta"}
    </button>
  );
}

export default function ContactForm() {
  const [state, formAction] = useActionState(submitContactForm, initialState);
  // Tracks the success state we've already dismissed, so a new submission
  // shows the thank-you message again.
  const [dismissedState, setDismissedState] =
    useState<ContactFormState | null>(null);
  const successRef = useRef<HTMLDivElement>(null);

  // After a successful send, show the thank-you message, then bring back a
  // fresh empty form — either after 10s or once it scrolls out of view.
  useEffect(() => {
    if (state.status !== "success" || dismissedState === state) return;

    const timer = setTimeout(() => setDismissedState(state), 10000);

    let observer: IntersectionObserver | undefined;
    const el = successRef.current;
    if (el) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) setDismissedState(state);
        },
        { threshold: 0 }
      );
      observer.observe(el);
    }

    return () => {
      clearTimeout(timer);
      observer?.disconnect();
    };
  }, [state, dismissedState]);

  if (state.status === "success" && dismissedState !== state) {
    return (
      <div
        ref={successRef}
        className="flex h-full min-h-[160px] items-center justify-center text-center py-8"
      >
        <span
          className="text-[21px] font-semibold leading-snug"
          style={{ color: "#1F8A5B" }}
        >
          ✓ ¡Gracias! Nos pondremos en contacto pronto.
        </span>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div>
        <label
          htmlFor="contact-nombre"
          className="block text-[13px] font-semibold text-white/60 mb-1.5 uppercase tracking-[.08em]"
        >
          Nombre
        </label>
        <input
          id="contact-nombre"
          type="text"
          name="nombre"
          placeholder="Su nombre completo"
          required
          className={`${inputClass} ${inputFocusClass}`}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-brand)";
            e.currentTarget.style.boxShadow =
              "0 0 0 4px rgba(218,90,14,.16)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,.16)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>

      <div>
        <label
          htmlFor="contact-email"
          className="block text-[13px] font-semibold text-white/60 mb-1.5 uppercase tracking-[.08em]"
        >
          Email
        </label>
        <input
          id="contact-email"
          type="email"
          name="email"
          placeholder="su@empresa.com"
          required
          className={`${inputClass} ${inputFocusClass}`}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-brand)";
            e.currentTarget.style.boxShadow =
              "0 0 0 4px rgba(218,90,14,.16)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,.16)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>

      <div>
        <label
          htmlFor="contact-mensaje"
          className="block text-[13px] font-semibold text-white/60 mb-1.5 uppercase tracking-[.08em]"
        >
          ¿Qué desea gestionar?
        </label>
        <textarea
          id="contact-mensaje"
          name="mensaje"
          rows={4}
          placeholder="Cuéntenos sobre su operación…"
          required
          className={`${inputClass} ${inputFocusClass} resize-none`}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-brand)";
            e.currentTarget.style.boxShadow =
              "0 0 0 4px rgba(218,90,14,.16)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,.16)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>

      {state.status === "error" && (
        <p className="text-[14px] text-red-400" aria-live="polite">
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
