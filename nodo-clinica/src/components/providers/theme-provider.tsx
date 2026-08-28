"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { applyThemeToDocument } from "@/hooks/use-theme-settings";
import { PATIENT_THEME_SETTINGS } from "@/lib/clinic/theme-settings";

/** Tema institucional fijo para TODA página pública (landing, /login,
 * /registro, etc.) — nunca refleja la personalización de ningún
 * médico/paciente.
 *
 * Se salta a propósito dentro de /paciente/* y /medico/*: esos layouts ya
 * aplican su propio tema (fijo o personalizado, según corresponda), y como
 * este provider vive en el layout raíz (por encima de ellos en el árbol),
 * si aplicara algo ahí correría su efecto DESPUÉS del layout específico
 * — React dispara efectos de adentro hacia afuera en el montaje — y
 * pisaría lo que el paciente/médico personalizó. Un solo aplicador de tema
 * activo por ruta evita esa carrera por completo. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inPortal = pathname?.startsWith("/paciente") || pathname?.startsWith("/medico");

  useEffect(() => {
    if (inPortal) return;
    applyThemeToDocument(PATIENT_THEME_SETTINGS);
  }, [pathname, inPortal]);

  return <>{children}</>;
}
