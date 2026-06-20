/** UI label → shared.org_members.role */
export const DISPLAY_TO_DB_ROLE: Record<string, string> = {
  Administrador: "admin",
  Empleado: "agent",
  Inquilino: "tenant",
  Propietario: "owner",
  // Legacy labels (existing members)
  Vendedor: "agent",
  Colega: "agent",
};

/** DB role → default UI label. */
export const DB_TO_DISPLAY_ROLE: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  agent: "Empleado",
  owner: "Propietario",
  tenant: "Inquilino",
};

export function displayRoleFromDb(dbRole: string): string {
  return DB_TO_DISPLAY_ROLE[dbRole] ?? dbRole;
}

export function dbRoleFromDisplay(displayRole: string): string {
  return DISPLAY_TO_DB_ROLE[displayRole] ?? "agent";
}
