/** Modo local por defecto durante la migración desde Django. */
export function isLocalMode(): boolean {
  return true;
}

export const DEMO_CREDENTIALS = {
  staff: { email: "direccion@nodo.demo", password: "demo1234" },
};
