import { getNodeBySlug, normalizeNodeSlug } from "@/lib/nodes";

export interface LoginPanelDetails {
  activeNodeSlug?: string;
  /** Shown after "NODO |" — omit for Core admin login. */
  nodeCode?: string;
  description: string;
  /** Full headline when there is no specific nodo (admin login). */
  coreHeadline?: string;
}

const CORE_PANEL: LoginPanelDetails = {
  description:
    "Panel de administración para gestionar clientes, unidades de negocio y el roadmap del Core.",
  coreHeadline: "El núcleo de gestión de su ecosistema.",
};

export function getLoginPanelDetails(nodeParam: string): LoginPanelDetails {
  if (!nodeParam) return CORE_PANEL;

  if (
    nodeParam === "nodo-clinica" ||
    nodeParam === "clinica-virtual" ||
    nodeParam === "clinica"
  ) {
    return {
      activeNodeSlug: "clinica",
      nodeCode: "Clínica Virtual",
      description:
        "Plataforma HealthTech para telemedicina profesional: consultorios virtuales, recetas digitales e informes automatizados con Inteligencia Artificial.",
    };
  }

  if (nodeParam === "nodo-autos" || nodeParam === "autos") {
    return {
      activeNodeSlug: "autos",
      nodeCode: "Automotores",
      description:
        "Panel de gestión de stock para concesionarias y agencias: inventario, clientes, publicaciones y contratos de venta digitales.",
    };
  }

  const matchedNode = getNodeBySlug(normalizeNodeSlug(nodeParam));
  if (matchedNode) {
    return {
      activeNodeSlug: matchedNode.slug,
      nodeCode: matchedNode.code,
      description: matchedNode.description,
    };
  }

  return CORE_PANEL;
}
