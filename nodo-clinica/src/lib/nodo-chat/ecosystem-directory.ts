import type { NodoChatContact } from "./types";

/**
 * Directorio demo de usuarios Pro de otros nodos.
 * En producción esto vendrá del hub central de Nodo Core (Supabase).
 */
export const ECOSYSTEM_PRO_CONTACTS: Omit<
  NodoChatContact,
  "online" | "lastSeen"
>[] = [
  {
    id: "ext-inmo-demo-1",
    fullName: "Carlos Martínez",
    role: "Martillero",
    nodeSlug: "inmo",
    nodeLabel: "Nodo Inmo",
    plan: "pro",
    specialty: "Inmobiliaria · Pro",
  },
  {
    id: "ext-inmo-demo-2",
    fullName: "Ana Rodríguez",
    role: "Administradora",
    nodeSlug: "inmo",
    nodeLabel: "Nodo Inmo",
    plan: "pro",
    specialty: "Gestión inmobiliaria",
  },
  {
    id: "ext-legal-demo-1",
    fullName: "Dr. Pablo Fernández",
    role: "Abogado",
    nodeSlug: "legal",
    nodeLabel: "Nodo Legal",
    plan: "pro",
    specialty: "Derecho sanitario",
  },
];
