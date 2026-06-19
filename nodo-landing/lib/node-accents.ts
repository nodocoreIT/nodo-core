/** Per-module accent colors (landing + login). Default Nodo orange stays in globals.css. */
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

/** Azul — no usado por otros nodos del ecosistema. */
export const ECOMMERCE_ACCENT = {
  brand: "#2563EB",
  brand600: "#1E3A8A",
  brand300: "#93C5FD",
  rgb: "37, 99, 235",
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
  if (key === "clinica" || key === "salud" || key === "clinica-virtual") return CLINICA_ACCENT;
  if (key === "obra") return OBRA_ACCENT;
  if (key === "contable") return CONTABLE_ACCENT;
  if (key === "ecommerce") return ECOMMERCE_ACCENT;
  if (key === "inmo") return DEFAULT_ACCENT;
  return DEFAULT_ACCENT;
}

export function getLoginAccent(nodeParam: string): NodeAccent {
  if (nodeParam === "nodo-autos" || nodeParam === "autos") return AUTOS_ACCENT;
  if (nodeParam === "nodo-finanzas" || nodeParam === "finanzas") return FINANZAS_ACCENT;
  if (nodeParam === "nodo-obra" || nodeParam === "obra") return OBRA_ACCENT;
  if (isClinicaLoginNode(nodeParam)) return CLINICA_ACCENT;
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
  const previous = {
    brand: root.style.getPropertyValue("--color-brand"),
    brand600: root.style.getPropertyValue("--color-brand-600"),
    brand300: root.style.getPropertyValue("--color-brand-300"),
    glow: root.style.getPropertyValue("--brand-glow"),
    glowStrong: root.style.getPropertyValue("--brand-glow-strong"),
    glowSoft: root.style.getPropertyValue("--brand-glow-soft"),
    focusRing: root.style.getPropertyValue("--login-focus-ring"),
  };

  root.style.setProperty("--color-brand", accent.brand);
  root.style.setProperty("--color-brand-600", accent.brand600);
  root.style.setProperty("--color-brand-300", accent.brand300);
  root.style.setProperty("--brand-glow", `rgba(${accent.rgb}, 0.4)`);
  root.style.setProperty("--brand-glow-strong", `rgba(${accent.rgb}, 0.55)`);
  root.style.setProperty("--brand-glow-soft", `rgba(${accent.rgb}, 0.2)`);
  root.style.setProperty("--login-focus-ring", `rgba(${accent.rgb}, 0.16)`);

  return () => {
    root.style.setProperty("--color-brand", previous.brand || DEFAULT_ACCENT.brand);
    root.style.setProperty("--color-brand-600", previous.brand600 || DEFAULT_ACCENT.brand600);
    root.style.setProperty("--color-brand-300", previous.brand300 || DEFAULT_ACCENT.brand300);
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
  };
}
