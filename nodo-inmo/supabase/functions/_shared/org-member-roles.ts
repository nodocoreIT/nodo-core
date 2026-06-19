/** Display label → shared.org_members.role */
export const DISPLAY_TO_DB_ROLE: Record<string, string> = {
  Administrador: "admin",
  Empleado: "agent",
  Inquilino: "tenant",
  Propietario: "owner",
  Vendedor: "agent",
  Colega: "agent",
};

export const DB_TO_DISPLAY_ROLE: Record<string, string> = {
  admin: "Administrador",
  agent: "Empleado",
  owner: "Propietario",
  tenant: "Inquilino",
};
