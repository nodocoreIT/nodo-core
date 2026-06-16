// Capitaliza la primera letra de cada palabra
export function capitalizarDescripcion(texto: string): string {
  return texto.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
