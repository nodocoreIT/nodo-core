import {
  Building2,
  HardHat,
  Coins,
  Cpu,
  Scale,
  Stethoscope,
  Wheat,
  Calculator,
  Car,
  type LucideIcon,
} from "lucide-react";

// Single source of truth for every business unit ("nodo"): its routing slug,
// display label, short blurb and icon. Consumed by the ecosystem diagram and
// by each /nodo-* route.
export interface NodeHighlight {
  title: string;
  description: string;
}

export interface NodeDef {
  code: string;
  slug: string;
  label: string;
  /** Short blurb — used in the diagram tooltip and as the page lead. */
  description: string;
  Icon: LucideIcon;
  /** Full section copy shown on the /nodo-* page. */
  intro?: string;
  /** Example feature cards shown below the intro. */
  highlights?: NodeHighlight[];
  /** Whether NodoCore can auto-provision an admin user in this nodo's Supabase. */
  provisionable?: boolean;
  /** Whether the node is currently in development. */
  inDevelopment?: boolean;
  /**
   * Slug of the parent node. When set, this node is rendered as a satellite
   * orbiting its parent rather than on the main Core orbit.
   */
  parentSlug?: string;
}

export const NODES: NodeDef[] = [
  {
    code: "Inmo",
    slug: "inmo",
    label: "Nodo Inmo",
    provisionable: true,
    inDevelopment: false,
    description:
      "Gestión inmobiliaria de nueva generación, con respaldo de martilleros públicos.",
    Icon: Building2,
    intro:
      "NODO Inmo es nuestra plataforma de gestión inmobiliaria, pensada tanto para nuestra propia operación como para todas las inmobiliarias que quieran llevar su negocio al siguiente nivel. Es un software completo que cualquier inmobiliaria puede contratar desde hoy: organizá tu cartera de propiedades, automatizá contratos, controlá tu caja y tus cobros, y manejá tu pipeline de ventas en un solo lugar. Y con el plan Pro sumás la llave de conexión con todo el ecosistema NODO.",
    highlights: [
      {
        title: "Plan Starter",
        description:
          "Cartera de propiedades digital, contratos de alquiler con ajuste por ICL o IPC, control de caja y cobros, y pipeline de ventas centralizado.",
      },
      {
        title: "Plan Pro",
        description:
          "Todo lo del Starter + portal para inquilinos (contrato, pagos y reclamos) y un bot de WhatsApp que responde consultas, avisa vencimientos y agenda visitas.",
      },
      {
        title: "NODO ID",
        description:
          "La llave de conexión con el ecosistema: Contable, Legal, Obra y más, todo integrado y transparente desde cualquier dispositivo.",
      },
    ],
  },
  {
    code: "Obra",
    slug: "obra",
    label: "Nodo Obra",
    inDevelopment: true,
    description:
      "Administración de proyectos constructivos: avances, gastos, registros y pagos.",
    Icon: HardHat,
    intro:
      "NODO Obra transforma la manera en que se administran los proyectos de construcción. A través de un software a medida, el inversor puede seguir el pulso de su obra en tiempo real: avances, registros fotográficos, gastos detallados y pagos, todo en un solo lugar. Se acabaron las llamadas para saber cómo va la obra, las planillas de Excel dispersas o los informes que llegan tarde. La información está siempre disponible, clara y transparente para todos los involucrados.",
  },
  {
    code: "Capital",
    slug: "capital",
    label: "Nodo Capital",
    inDevelopment: true,
    description:
      "División financiera enfocada en la formación de grupos inversores.",
    Icon: Coins,
    intro:
      "NODO Capital es nuestra división financiera, y una de las más estratégicas del ecosistema. Nos enfocamos en la formación de grupos inversores, capitalizando el conocimiento y la experiencia de NODO para potenciar proyectos inmobiliarios y de construcción. Transformamos ahorros en activos reales y rentables. Si querés que tu capital trabaje de forma inteligente, NODO Capital te abre la puerta a oportunidades de inversión concretas, respaldadas por todo el ecosistema.",
  },
  {
    code: "IT",
    slug: "it",
    label: "Nodo IT",
    inDevelopment: false,
    description:
      "El motor tecnológico: software a medida e infraestructura corporativa.",
    Icon: Cpu,
    intro:
      "NODO IT es el motor tecnológico que hace posible todo el ecosistema. Desde el desarrollo de software a medida hasta la gestión de infraestructura de red y plataformas corporativas, nuestro equipo trabaja para que cada nodo funcione de forma eficiente, segura y escalable. Pero lo que realmente nos diferencia es la conexión: NODO IT es la capa que permite que Inmo, Obra, Contable, Legal, Agro y Capital se hablen entre sí, compartan datos y operen como un único organismo. Cada nodo que sumás se integra automáticamente con los demás. Eso es la tecnología como eje, no como herramienta.",
  },
  {
    code: "Legal",
    slug: "legal",
    label: "Nodo Legal",
    inDevelopment: true,
    description:
      "Asesoramiento jurídico integral, transversal a todas las áreas.",
    Icon: Scale,
    intro:
      "NODO Legal es el eje jurídico que atraviesa todo el ecosistema. Brindamos asesoramiento legal integral a todas nuestras unidades de negocio y a nuestros clientes, garantizando que cada operación, contrato e inversión esté respaldada con sólidos fundamentos legales. En una plataforma que mueve activos reales —propiedades, obras e inversiones— la solidez jurídica no es un detalle: es una condición indispensable.",
  },
  {
    code: "Salud",
    slug: "salud",
    label: "Nodo Salud",
    inDevelopment: false,
    description:
      "Inteligencia médica colaborativa: descentralización de historias clínicas y gestión digital para especialistas.",
    Icon: Stethoscope,
    intro:
      "NODO | Salud es el entorno digital donde la medicina se descentraliza para ser más eficiente. Funciona como un nodo integrador de profesionales de distintas ramas, permitiendo la gestión inteligente de historias clínicas, la interconsulta interdisciplinaria y la trazabilidad de datos de pacientes en un entorno privado, seguro y estandarizado. Más que una plataforma de gestión, es el punto de encuentro donde el conocimiento clínico se conecta con la tecnología para reducir la fragmentación asistencial. Actualmente en fase de desarrollo, integrando los protocolos de seguridad más avanzados del mercado para asegurar que cada byte de información médica esté protegido bajo nuestra arquitectura NODO.",
    highlights: [
      {
        title: "Interoperabilidad Médica",
        description:
          "Unificamos datos para que el historial del paciente fluya entre especialistas bajo estrictos estándares de seguridad y confidencialidad.",
      },
      {
        title: "Ecosistema Colaborativo",
        description:
          "Facilitamos la conformación de juntas médicas digitales y la transferencia de conocimiento técnico entre distintas especialidades.",
      },
      {
        title: "Seguridad por Diseño",
        description:
          "Garantizamos control total sobre la privacidad y el acceso a la información médica bajo nuestra arquitectura NODO.",
      },
    ],
  },
  {
    code: "Agro",
    slug: "agro",
    label: "Nodo Agro",
    inDevelopment: true,
    description:
      "Soluciones integrales para el sector productivo y los negocios rurales.",
    Icon: Wheat,
    intro:
      "NODO Agro lleva la inteligencia de la plataforma al sector productivo. Con el respaldo de nuestro equipo de ingeniería agronómica, brindamos soluciones integrales para negocios rurales: desde el asesoramiento especializado en compra de hacienda y animales, hasta la optimización de la rentabilidad y el seguimiento de operaciones agrícolas y ganaderas. Porque el campo también merece gestión inteligente, transparente y conectada.",
  },
  {
    code: "Contable",
    slug: "contable",
    label: "Nodo Contable",
    inDevelopment: true,
    description:
      "Gestión contable e impositiva: balances, liquidaciones de impuestos y cumplimiento fiscal.",
    Icon: Calculator,
  },
  {
    code: "Clínica",
    slug: "clinica",
    label: "Nodo Clínica",
    parentSlug: "salud",
    description:
      "Plataforma HealthTech para telemedicina profesional: consultorios virtuales, recetas digitales e informes automatizados con IA.",
    Icon: Stethoscope,
    intro:
      "Digitaliza tu consultorio: agenda online, videoconsultas, prescripciones digitales y resúmenes SOAP generados con IA.",
    highlights: [
      {
        title: "Videoconsultas",
        description:
          "Consultorios virtuales con Jitsi Meet, sin instalaciones.",
      },
      {
        title: "IA Clínica",
        description:
          "Resúmenes SOAP automáticos desde la transcripción de la consulta.",
      },
      {
        title: "Recetas digitales",
        description:
          "Emití prescripciones y pedidos de estudios con firma digital en PDF.",
      },
    ],
    provisionable: true,
  },
  {
    code: "Finanzas",
    slug: "finanzas",
    label: "Nodo Finanzas Personales",
    parentSlug: "it",
    inDevelopment: false,
    description:
      "Gestión de finanzas personales: cuentas, gastos, tarjetas, préstamos y mucho mas.",
    Icon: Coins,
    intro:
      "Nodo Finanzas Personales es tu panel de control financiero. Registrá gastos diarios y fijos, gestioná tus tarjetas de crédito con lógica de cuotas, seguí préstamos y planes de ahorro, y visualizá tu situación financiera en un informe mensual detallado.",
    highlights: [
      {
        title: "Control de gastos",
        description:
          "Registrá gastos diarios y fijos por rubro, con soporte para múltiples cuentas y formas de pago.",
      },
      {
        title: "Tarjetas y cuotas",
        description:
          "Seguimiento completo de consumos en tarjetas de crédito con cálculo automático de períodos y cuotas.",
      },
      {
        title: "Informe mensual",
        description:
          "Visualización gráfica de tu situación financiera: gastos por categoría, evolución diaria y balance del mes.",
      },
    ],
    provisionable: false,
  },
  {
    code: "Autos",
    slug: "autos",
    label: "Nodo Automotores",
    parentSlug: "it",
    description:
      "Panel de gestión de stock para concesionarias y agencias de autos: inventario, clientes, publicaciones y contratos de venta.",
    Icon: Car,
    intro:
      "Administrá tu agencia desde un solo lugar: cargá vehículos, gestioná clientes, publicá en redes y generá contratos de venta.",
    highlights: [
      {
        title: "Stock inteligente",
        description:
          "Inventario de vehículos con fotos, filtros avanzados y estado en tiempo real.",
      },
      {
        title: "Publicación multicanal",
        description:
          "Publicá en Instagram, Facebook, MercadoLibre y tu sitio web desde un solo panel.",
      },
      {
        title: "Contratos digitales",
        description:
          "Generá contratos de compraventa en PDF con datos del comprador y condiciones de pago.",
      },
    ],
    provisionable: true,
  },
];

export function getNodeBySlug(slug: string): NodeDef | undefined {
  return NODES.find((n) => n.slug === slug);
}
