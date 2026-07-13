/** Per-module accent colors (landing + login). Default Nodo orange stays in globals.css. */
import { NODES } from "@/lib/nodes";

export const AUTOS_ACCENT = {
  brand: "#D12D3C",
  brand600: "#B02535",
  brand300: "#F0808C",
  rgb: "209, 45, 60",
} as const;

/** Sampled from public/logos/nodo ver.png */
export const FINANZAS_ACCENT = {
  brand: "#43936C",
  brand600: "#357A59",
  brand300: "#8FC4A8",
  rgb: "67, 147, 108",
} as const;

export const CLINICA_ACCENT = {
  brand: "#0D9488",
  brand600: "#0F766E",
  brand300: "#5EEAD4",
  rgb: "13, 148, 136",
} as const;

/** Amarillo construcción — tonos oscuros en brand600 para texto legible sobre fondo claro. */
export const OBRA_ACCENT = {
  brand: "#CA8A04",
  brand600: "#5C4810",
  brand300: "#FDE68A",
  rgb: "202, 138, 4",
} as const;

export const CONTABLE_ACCENT = {
  brand: "#7C3AED",
  brand600: "#5B21B6",
  brand300: "#C4B5FD",
  rgb: "124, 58, 237",
} as const;

/** Amarillo neón — identidad visual de Nodo Ecommerce. */
export const ECOMMERCE_ACCENT = {
  brand: "#FFF600",
  brand600: "#D4CC00",
  brand300: "#FFFB80",
  rgb: "255, 246, 0",
} as const;

export const DEFAULT_ACCENT = {
  brand: "#DA5A0E",
  brand600: "#C04E0B",
  brand300: "#F0A877",
  rgb: "218, 90, 14",
} as const;

export interface NodeAccent {
  brand: string;
  brand600: string;
  brand300: string;
  rgb: string;
}

export function isClinicaLoginNode(nodeParam: string): boolean {
  return (
    nodeParam === "nodo-clinica" ||
    nodeParam === "clinica-virtual" ||
    nodeParam === "clinica"
  );
}

export function getNodeAccentBySlug(slug: string): NodeAccent {
  const key = slug.trim().toLowerCase();
  if (key === "autos" || key === "automotores") return AUTOS_ACCENT;
  if (key === "finanzas") return FINANZAS_ACCENT;
  if (key === "clinica" || key === "salud" || key === "clinica-virtual" || key === "clínica") return CLINICA_ACCENT;
  if (key === "obra") return OBRA_ACCENT;
  if (key === "contable") return CONTABLE_ACCENT;
  if (key === "ecommerce") return ECOMMERCE_ACCENT;
  if (key === "inmo") return DEFAULT_ACCENT;
  return DEFAULT_ACCENT;
}

/** Resolve dashboard `unit_code` (e.g. Inmo, Autos, Clínica) to module branding. */
export function getNodeAccentByCode(unitCode: string): NodeAccent {
  const normalized = unitCode.trim().toLowerCase();
  const node = NODES.find(
    (n) =>
      n.code.toLowerCase() === normalized ||
      n.slug.toLowerCase() === normalized,
  );
  return getNodeAccentBySlug(node?.slug ?? normalized);
}

export function getLoginAccent(nodeParam: string): NodeAccent {
  if (nodeParam === "nodo-autos" || nodeParam === "autos") return AUTOS_ACCENT;
  if (nodeParam === "nodo-finanzas" || nodeParam === "finanzas") return FINANZAS_ACCENT;
  if (nodeParam === "nodo-obra" || nodeParam === "obra") return OBRA_ACCENT;
  if (isClinicaLoginNode(nodeParam)) return CLINICA_ACCENT;
  if (nodeParam === "nodo-ecommerce" || nodeParam === "ecommerce") return ECOMMERCE_ACCENT;
  return DEFAULT_ACCENT;
}

/** Wordmark PNG path per nodo (public/logos). */
export function getNodoLogoSrc(nodeParamOrSlug: string): string {
  const raw = nodeParamOrSlug.trim().toLowerCase();
  const slug = raw.startsWith("nodo-") ? raw.slice(5) : raw;
  if (slug === "autos") return "/logos/nodo%20roj.png";
  if (slug === "finanzas") return "/logos/nodo%20ver.png";
  if (slug === "clinica" || slug === "clinica-virtual" || slug === "salud") {
    return "/logos/nodo%20ver%20clinica.png";
  }
  return "/logos/nodo%20nar.png";
}

export function applyLoginAccent(accent: NodeAccent): () => void {
  const root = document.documentElement;
  // Determine if the brand color is light (requires dark text on top).
  // Only ecommerce yellow qualifies; all other brand colors are dark enough for white text.
  const isLightBrand = accent.brand === ECOMMERCE_ACCENT.brand;
  // --color-brand-on: text color to use ON TOP of the brand color background
  // --color-brand-kicker: text color for kicker labels on a neutral (white/gray) background
  const brandOn = isLightBrand ? "#000000" : "#ffffff";
  const brandKicker = isLightBrand ? "#000000" : accent.brand;

  const previous = {
    brand: root.style.getPropertyValue("--color-brand"),
    brand600: root.style.getPropertyValue("--color-brand-600"),
    brand300: root.style.getPropertyValue("--color-brand-300"),
    brandOn: root.style.getPropertyValue("--color-brand-on"),
    brandKicker: root.style.getPropertyValue("--color-brand-kicker"),
    glow: root.style.getPropertyValue("--brand-glow"),
    glowStrong: root.style.getPropertyValue("--brand-glow-strong"),
    glowSoft: root.style.getPropertyValue("--brand-glow-soft"),
    focusRing: root.style.getPropertyValue("--login-focus-ring"),
    colorRing: root.style.getPropertyValue("--color-ring"),
  };

  root.style.setProperty("--color-brand", accent.brand);
  root.style.setProperty("--color-brand-600", accent.brand600);
  root.style.setProperty("--color-brand-300", accent.brand300);
  root.style.setProperty("--color-brand-on", brandOn);
  root.style.setProperty("--color-brand-kicker", brandKicker);
  root.style.setProperty("--brand-glow", `rgba(${accent.rgb}, 0.4)`);
  root.style.setProperty("--brand-glow-strong", `rgba(${accent.rgb}, 0.55)`);
  root.style.setProperty("--brand-glow-soft", `rgba(${accent.rgb}, 0.2)`);
  root.style.setProperty("--login-focus-ring", `rgba(${accent.rgb}, 0.16)`);
  root.style.setProperty("--color-ring", accent.brand);

  return () => {
    root.style.setProperty("--color-brand", previous.brand || DEFAULT_ACCENT.brand);
    root.style.setProperty("--color-brand-600", previous.brand600 || DEFAULT_ACCENT.brand600);
    root.style.setProperty("--color-brand-300", previous.brand300 || DEFAULT_ACCENT.brand300);
    root.style.setProperty("--color-brand-on", previous.brandOn || "#ffffff");
    root.style.setProperty("--color-brand-kicker", previous.brandKicker || DEFAULT_ACCENT.brand);
    root.style.setProperty("--brand-glow", previous.glow || "rgba(218, 90, 14, 0.4)");
    root.style.setProperty(
      "--brand-glow-strong",
      previous.glowStrong || "rgba(218, 90, 14, 0.55)",
    );
    root.style.setProperty(
      "--brand-glow-soft",
      previous.glowSoft || "rgba(218, 90, 14, 0.2)",
    );
    if (previous.focusRing) {
      root.style.setProperty("--login-focus-ring", previous.focusRing);
    } else {
      root.style.removeProperty("--login-focus-ring");
    }
    if (previous.colorRing) {
      root.style.setProperty("--color-ring", previous.colorRing);
    } else {
      root.style.removeProperty("--color-ring");
    }
  };
}
