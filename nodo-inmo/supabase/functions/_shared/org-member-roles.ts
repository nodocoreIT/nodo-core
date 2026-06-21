/** Display label → shared.org_members.role */
export const DISPLAY_TO_DB_ROLE: Record<string, string> = {
  // nodo-inmo roles
  Administrador: "admin",
  Empleado: "agent",
  Inquilino: "tenant",
  Propietario: "owner",
  Vendedor: "agent",
  Colega: "agent",
  // nodo-autos roles (callers may pass display label or DB role directly)
  Invitado: "guest",
  // nodo-finanzas roles
  Miembro: "member",
  // Identity mappings: allow callers to pass DB roles directly
  // (avoids the "agent" fallback when role is already a valid DB value)
  seller: "seller",
  guest: "guest",
  member: "member",
};

export const DB_TO_DISPLAY_ROLE: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  agent: "Empleado",
  owner: "Propietario",
  tenant: "Inquilino",
  // nodo-autos roles
  seller: "Vendedor",
  guest: "Invitado",
  // nodo-finanzas roles
  member: "Miembro",
};
