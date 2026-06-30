"use client";

import { Suspense } from "react";
import { LoginForm } from "../../[nodeSlug]/login/page";

/** Login de Clínica en nodocore.com.ar/nodo-clinica/login (misma URL que Nodo Inmo). */
export default function NodoClinicaLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-navy-900 text-white flex items-center justify-center font-semibold">
          Cargando...
        </div>
      }
    >
      <LoginForm forcedNodeSlug="nodo-clinica" />
    </Suspense>
  );
}
