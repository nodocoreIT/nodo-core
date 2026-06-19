import { NODES } from "@/lib/nodes";

export type CommandPaletteGroup =
  | "navegacion"
  | "unidades"
  | "acceso"
  | "acciones";

export interface CommandPaletteItem {
  id: string;
  label: string;
  href: string;
  group: CommandPaletteGroup;
  keywords: string[];
  badge?: string;
}

export const COMMAND_PALETTE_GROUP_LABELS: Record<CommandPaletteGroup, string> =
  {
    navegacion: "Navegación",
    unidades: "Unidades de negocio",
    acceso: "Ingreso",
    acciones: "Acciones",
  };

const NODE_KEYWORDS: Record<string, string[]> = {
  inmo: [
    "inmobiliaria",
    "propiedades",
    "alquileres",
    "martillero",
    "contratos",
    "caja",
    "pipeline",
    "whatsapp",
  ],
  obra: ["construcción", "obra", "proyecto", "avances", "inversor"],
  capital: ["inversión", "inversores", "capital", "rentabilidad", "ahorro"],
  it: [
    "software",
    "tecnología",
    "desarrollo",
    "infraestructura",
    "sistemas",
    "integración",
  ],
  legal: ["jurídico", "abogado", "contratos", "legal"],
  salud: [
    "medicina",
    "historia clínica",
    "pacientes",
    "interconsulta",
    "salud",
  ],
  agro: ["campo", "rural", "ganadería", "hacienda", "agrícola"],
  contable: [
    "contador",
    "contabilidad",
    "impuestos",
    "balances",
    "fiscal",
    "liquidaciones",
  ],
  clinica: [
    "telemedicina",
    "videoconsultas",
    "recetas",
    "médico",
    "paciente",
    "clínica virtual",
    "soap",
  ],
  finanzas: [
    "gastos",
    "tarjetas",
    "préstamos",
    "ahorro",
    "presupuesto",
    "finanzas personales",
    "cuentas",
  ],
  autos: [
    "automotores",
    "concesionaria",
    "vehículos",
    "stock",
    "mercadolibre",
    "instagram",
  ],
};

function nodeLandingHref(slug: string): string {
  return `/nodo-${slug}`;
}

function nodeLoginHref(slug: string): string {
  return `/nodo-${slug}/login`;
}

export function buildCommandPaletteItems(): CommandPaletteItem[] {
  const items: CommandPaletteItem[] = [
    {
      id: "home",
      label: "Inicio",
      href: "/",
      group: "navegacion",
      keywords: ["home", "principal", "nodo core", "ecosistema"],
    },
    {
      id: "filosofia",
      label: "Filosofía",
      href: "/#filosofia",
      group: "navegacion",
      keywords: ["qué es nodo", "ecosistema", "visión", "núcleo"],
    },
    {
      id: "unidades",
      label: "Unidades",
      href: "/#unidades",
      group: "navegacion",
      keywords: ["nodos", "servicios", "funcionalidades", "oferta"],
    },
    {
      id: "beneficios",
      label: "Beneficios",
      href: "/#beneficios",
      group: "navegacion",
      keywords: ["ventajas", "cliente", "visibilidad", "interlocutor"],
    },
    {
      id: "contacto",
      label: "Contacto",
      href: "/#contacto",
      group: "navegacion",
      keywords: ["demo", "consulta", "email", "escribinos", "formulario"],
    },
  ];

  for (const node of NODES) {
    const extraKeywords = NODE_KEYWORDS[node.slug] ?? [];
    const highlightKeywords =
      node.highlights?.flatMap((h) => [h.title, h.description]) ?? [];

    items.push({
      id: `node-${node.slug}`,
      label: node.label,
      href: nodeLandingHref(node.slug),
      group: "unidades",
      keywords: [
        node.code,
        node.slug,
        node.description,
        node.parentSlug ? "submódulo" : "unidad",
        ...(node.inDevelopment ? ["en desarrollo", "próximamente"] : []),
        ...extraKeywords,
        ...highlightKeywords,
      ],
      badge: node.inDevelopment ? "En desarrollo" : undefined,
    });

    if (node.provisionable) {
      items.push({
        id: `login-${node.slug}`,
        label: `Entrar a ${node.code}`,
        href: nodeLoginHref(node.slug),
        group: "acceso",
        keywords: [
          "login",
          "ingresar",
          "acceso",
          "sesión",
          node.code,
          node.slug,
          ...extraKeywords,
        ],
      });
    }
  }

  items.push(
    {
      id: "clinica-virtual",
      label: "Clínica Virtual",
      href: "/nodo-salud/clinica-virtual",
      group: "unidades",
      keywords: [
        "telemedicina",
        "salud",
        "videoconsultas",
        "médicos",
        "pacientes",
      ],
    },
    {
      id: "ecommerce",
      label: "E-commerce a medida",
      href: "/#contacto",
      group: "unidades",
      keywords: [
        "tienda online",
        "ecommerce",
        "ventas",
        "it",
        "desarrollo web",
      ],
      badge: "Consultar",
    },
    {
      id: "precios-inmo",
      label: "Precios Nodo Inmo",
      href: "/nodo-inmo#precios",
      group: "acciones",
      keywords: ["planes", "starter", "pro", "tarifas", "inmobiliaria"],
    },
    {
      id: "solicitar-demo",
      label: "Solicitar demo",
      href: "/#contacto",
      group: "acciones",
      keywords: ["contacto", "reunión", "propuesta", "consulta"],
    },
    {
      id: "panel-admin",
      label: "Panel de administración",
      href: "/login",
      group: "acciones",
      keywords: ["admin", "administración", "core", "backoffice"],
      badge: "Admin",
    },
  );

  return items;
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

export function filterCommandPaletteItems(
  items: CommandPaletteItem[],
  query: string,
): CommandPaletteItem[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return items;

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  return items.filter((item) => {
    const haystack = normalizeSearchText(
      [item.label, item.badge ?? "", ...item.keywords].join(" "),
    );
    return terms.every((term) => haystack.includes(term));
  });
}
