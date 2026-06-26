import {
  Building2,
  HardHat,
  Coins,
  Cpu,
  Scale,
  Stethoscope,
  Wheat,
  Calculator,
  type LucideIcon,
} from "lucide-react";

export interface NodeDef {
  code: string;
  slug: string;
  label: string;
  description: string;
  Icon: LucideIcon;
  inDevelopment?: boolean;
}

export const NODES: NodeDef[] = [
  {
    code: "Inmo",
    slug: "inmo",
    label: "Nodo Inmo",
    description:
      "Gestión inmobiliaria de nueva generación, con respaldo de martilleros públicos.",
    Icon: Building2,
  },
  {
    code: "Obra",
    slug: "obra",
    label: "Nodo Obra",
    inDevelopment: true,
    description:
      "Administración de proyectos constructivos: avances, gastos, registros y pagos.",
    Icon: HardHat,
  },
  {
    code: "Capital",
    slug: "capital",
    label: "Nodo Capital",
    inDevelopment: true,
    description: "División financiera enfocada en la formación de grupos inversores.",
    Icon: Coins,
  },
  {
    code: "IT",
    slug: "it",
    label: "Nodo IT",
    inDevelopment: true,
    description: "El motor tecnológico: software a medida e infraestructura corporativa.",
    Icon: Cpu,
  },
  {
    code: "Legal",
    slug: "legal",
    label: "Nodo Legal",
    inDevelopment: true,
    description: "Asesoramiento jurídico integral, transversal a todas las áreas.",
    Icon: Scale,
  },
  {
    code: "Salud",
    slug: "salud",
    label: "Nodo Salud",
    description:
      "Telemedicina profesional: agenda, videoconsultas, historial clínico e informes con IA.",
    Icon: Stethoscope,
  },
  {
    code: "Agro",
    slug: "agro",
    label: "Nodo Agro",
    inDevelopment: true,
    description: "Soluciones integrales para el sector productivo y los negocios rurales.",
    Icon: Wheat,
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
];
