"use client";

import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

function VerifiedContent() {
  const searchParams = useSearchParams();
  const node = searchParams.get("node") ?? "salud";
  const status = searchParams.get("status");
  const role = searchParams.get("role");

  const isPendingReview = status === "pending_review";
  const loginHref = role === "paciente"
    ? `/nodo-clinica/login?role=paciente`
    : `/${node}/login`;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-navy-900)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-8 text-center"
        style={{
          background: "var(--color-navy-800)",
          borderColor: "rgba(255,255,255,.08)",
        }}
      >
        <Image
          src="/logos/logo compuesto.png"
          alt="NODO Core"
          height={30}
          width={140}
          className="mx-auto mb-6 h-[30px] w-auto"
        />

        {isPendingReview ? (
          <>
            <h1 className="text-xl font-semibold text-white mb-3">Email verificado</h1>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(234,240,247,.65)" }}>
              Tu correo fue confirmado. Nuestro equipo revisará tu solicitud y te enviará un
              email cuando tu acceso esté habilitado para completar el registro.
            </p>
          </>
        ) : status === "existing" ? (
          <>
            <h1 className="text-xl font-semibold text-white mb-3">Ya tenés una solicitud</h1>
            <p className="text-sm" style={{ color: "rgba(234,240,247,.65)" }}>
              Este correo ya está registrado en este nodo. Si necesitás ayuda, contactanos.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-white mb-3">¡Cuenta activada!</h1>
            <p className="text-sm mb-6" style={{ color: "rgba(234,240,247,.65)" }}>
              Tu registro fue verificado correctamente. Ya podés iniciar sesión.
            </p>
            <Link
              href={loginHref}
              className="inline-block rounded-lg px-6 py-3 text-sm font-semibold text-white"
              style={{ background: "#DA5A0E" }}
            >
              Ir al login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function RegistroVerificadoPage() {
  return (
    <Suspense>
      <VerifiedContent />
    </Suspense>
  );
}
