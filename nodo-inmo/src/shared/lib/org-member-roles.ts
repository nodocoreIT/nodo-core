/** UI label → shared.org_members.role */
export const DISPLAY_TO_DB_ROLE: Record<string, string> = {
  Administrador: "admin",
  Vendedor: "agent",
  Inquilino: "tenant",
  Propietario: "owner",
  Colega: "agent",
};

/** DB role → default UI label (agent → Colega). */
export const DB_TO_DISPLAY_ROLE: Record<string, string> = {
  admin: "Administrador",
  agent: "Colega",
  owner: "Propietario",
  tenant: "Inquilino",
};

export function displayRoleFromDb(dbRole: string): string {
  return DB_TO_DISPLAY_ROLE[dbRole] ?? dbRole;
}

export function dbRoleFromDisplay(displayRole: string): string {
  return DISPLAY_TO_DB_ROLE[displayRole] ?? "agent";
}
