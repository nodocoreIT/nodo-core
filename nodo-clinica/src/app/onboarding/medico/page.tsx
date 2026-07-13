"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";

const NODO_CORE_URL = process.env.NEXT_PUBLIC_NODO_LANDING_URL ?? "https://nodocore.com.ar";

function OnboardingMedicoForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }
    fetch(`/api/onboarding/validate?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setTokenValid(true);
          if (data.email) setEmail(data.email);
          if (data.first_name) setFirstName(data.first_name);
          if (data.last_name) setLastName(data.last_name);
        }
      })
      .catch(() => {})
      .finally(() => setValidating(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("token", token);
      formData.append("firstName", firstName);
      formData.append("lastName", lastName);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("specialty", specialty);
      formData.append("licenseNumber", licenseNumber);

      const res = await fetch("/api/onboarding/medico/complete", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Error al enviar la solicitud.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-lg px-3 py-2.5 text-sm bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 transition-shadow";

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 text-sm">Validando enlace…</p>
      </div>
    );
  }

  if (!token || !tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-sm w-full text-center shadow-md">
          <p className="text-red-500 font-semibold mb-2">Enlace inválido o expirado</p>
          <p className="text-slate-500 text-sm">Contactá a NODO Core para solicitar un nuevo enlace.</p>
          <a
            href={NODO_CORE_URL}
            className="inline-block mt-6 px-6 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
          >
            Volver a NODO Core
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-xl mx-auto">
        {/* Logo / header */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${NODO_CORE_URL}/logos/logo%20compuestoa.png`}
            alt="NODO Core"
            className="h-7 mx-auto mb-3"
          />
          <h1 className="text-xl font-bold text-slate-800">Completá tu registro</h1>
          <p className="text-slate-500 text-sm mt-1">
            Datos del médico. La contraseña la configurás al primer ingreso.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Nombre
                </label>
                <input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                  placeholder="Juan"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Apellido
                </label>
                <input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                  placeholder="García"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                readOnly
                className={`${inputClass} bg-slate-50 text-slate-500 cursor-not-allowed`}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Teléfono
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                placeholder="+54 11 1234-5678"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Especialidad
                </label>
                <input
                  required
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className={inputClass}
                  placeholder="Medicina General"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Matrícula
                </label>
                <input
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  className={inputClass}
                  placeholder="MN 12345"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 active:scale-[.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Enviando…" : "Enviar registro"}
            </button>
          </form>
        </div>
      </div>

      {/* Success modal */}
      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl border border-slate-100">
            <div className="h-14 w-14 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-teal-100">
              <CheckCircle2 className="h-7 w-7 text-teal-600" />
            </div>
            <h3 className="font-bold text-slate-800 text-xl mb-2">
              ¡Registro completado!
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Pronto desde NODO activaremos tu cuenta. Una vez habilitada, te llegará
              un correo para configurar tu contraseña e ingresar.
            </p>
            <a
              href={NODO_CORE_URL}
              className="block w-full py-3 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 active:scale-[.98] transition-all text-center"
            >
              Volver a NODO Core
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OnboardingMedicoPage() {
  return (
    <Suspense>
      <OnboardingMedicoForm />
    </Suspense>
  );
}
