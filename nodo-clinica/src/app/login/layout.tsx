"use client";

import { useEffect } from "react";
import { resetThemeToDocument } from "@/hooks/use-theme-settings";

/** El login es institucional y fijo — nunca debe reflejar la
 * personalización de tema de ningún médico/paciente. Las variables CSS de
 * marca se escriben directo en <html>, así que persisten entre
 * navegaciones SPA aunque el usuario haya cerrado sesión; este layout las
 * resetea al entrar a cualquier ruta de /login. */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    resetThemeToDocument();
  }, []);

  return <>{children}</>;
}
