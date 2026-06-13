export type PlanTier = "starter" | "pro";

export type NodoStatus = "development" | "planned" | "not_started";

export interface PlanPricing {
  monthly: number;
  annual: number;
  currency: string;
}

export interface PlanFeature {
  text: string;
  minPlan: PlanTier;
}

export interface FeatureGroup {
  label: string;
  features: PlanFeature[];
}

export interface NodoPlanConfig {
  slug: string;
  label: string;
  status: NodoStatus;
  description: string;
  plans?: {
    starter: PlanPricing;
    pro: PlanPricing;
  };
  featureGroups?: FeatureGroup[];
}

export const NODO_PLANS: NodoPlanConfig[] = [
  {
    slug: "inmo",
    label: "Nodo Inmo",
    status: "development",
    description: "Gestión inmobiliaria de nueva generación, con respaldo de martilleros públicos.",
    plans: {
      starter: { monthly: 75, annual: 65, currency: "USD" },
      pro: { monthly: 125, annual: 115, currency: "USD" },
    },
    featureGroups: [
      {
        label: "Propiedades",
        features: [
          { text: "Alta y ficha completa de cada propiedad", minPlan: "starter" },
          { text: "Fotos y documentos adjuntos", minPlan: "starter" },
          { text: "Estados: disponible, alquilada o vendida", minPlan: "starter" },
          { text: "Búsqueda y filtros avanzados", minPlan: "starter" },
          { text: "Web interna con visualización y opción de compartir detalle", minPlan: "starter" },
        ],
      },
      {
        label: "Contratos de alquiler",
        features: [
          { text: "Cálculo automático de aumentos (ICL/IPC)", minPlan: "starter" },
          { text: "Alertas de vencimiento de contrato", minPlan: "starter" },
          { text: "Generación automática de contratos desde carga de datos", minPlan: "pro" },
        ],
      },
      {
        label: "Caja y cobros",
        features: [
          { text: "Cobros de alquiler y expensas (efectivo y transferencia)", minPlan: "starter" },
          { text: "Cuentas bancarias", minPlan: "starter" },
          { text: "Caja interna: ingresos/egresos de caja chica", minPlan: "starter" },
          { text: "Historial de pagos e informe de morosidad", minPlan: "starter" },
          { text: "Integración con Mercado Pago", minPlan: "pro" },
        ],
      },
      {
        label: "Ventas",
        features: [
          { text: "Pipeline: interesado, reserva", minPlan: "starter" },
          { text: "Estadísticas de ventas por empleado (productividad)", minPlan: "pro" },
        ],
      },
      {
        label: "Usuarios",
        features: [
          { text: "Roles Admin y Agentes de la inmobiliaria", minPlan: "starter" },
          { text: "Acceso web y móvil, sin instalación", minPlan: "starter" },
          { text: "Portal Propietario con Rol Propietario", minPlan: "pro" },
          { text: "Portal Inquilinos: contrato, pagos e historial", minPlan: "pro" },
          { text: "Elevación de reclamos y seguimiento desde el portal", minPlan: "pro" },
        ],
      },
      {
        label: "Automatizaciones",
        features: [
          { text: "Bot WhatsApp 24/7: responde consultas automáticamente", minPlan: "pro" },
          { text: "Avisos de vencimiento, aumentos y mora por WhatsApp", minPlan: "pro" },
          { text: "Administración automática de redes sociales", minPlan: "pro" },
        ],
      },
      {
        label: "Integraciones",
        features: [
          { text: "Gmail y Google Sheets", minPlan: "pro" },
          { text: "NODO ID: llave de conexión con el ecosistema", minPlan: "pro" },
        ],
      },
    ],
  },
  {
    slug: "obra",
    label: "Nodo Obra",
    status: "not_started",
    description: "Administración de proyectos constructivos: avances, gastos, registros y pagos.",
  },
  {
    slug: "contable",
    label: "Nodo Contable",
    status: "not_started",
    description: "Gestión contable e impositiva: balances, liquidaciones y cumplimiento fiscal.",
  },
  {
    slug: "ecommerce",
    label: "Nodo Ecommerce",
    status: "not_started",
    description: "Plataforma de comercio digital integrada al ecosistema NODO.",
  },
  {
    slug: "automotores",
    label: "Nodo Automotores",
    status: "not_started",
    description: "Gestión de concesionarias y compraventa de vehículos.",
  },
];

export function getNodoPlanBySlug(slug: string): NodoPlanConfig | undefined {
  return NODO_PLANS.find((n) => n.slug === slug);
}

export const STATUS_LABEL: Record<NodoStatus, string> = {
  development: "En desarrollo",
  planned: "Planificado",
  not_started: "Sin comenzar",
};

export const STATUS_COLOR: Record<NodoStatus, { bg: string; text: string }> = {
  development: { bg: "rgba(218,90,14,.15)", text: "var(--color-brand)" },
  planned: { bg: "rgba(45,140,255,.12)", text: "rgba(100,180,255,.9)" },
  not_started: { bg: "rgba(255,255,255,.06)", text: "rgba(234,240,247,.4)" },
};
