/** Mirrors @nodocore/shared-components AuthConfig without importing the client barrel. */
export interface AuthConfig {
  roleDestinations: Record<string, string>;
  unitCode?: string;
  allowedRoles?: string[];
}
