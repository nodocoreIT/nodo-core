/**
 * Formatea un código de rubro legacy (p. ej. RESTAURACION_AUTOS → "Restauracion Autos").
 * Si el valor ya es un nombre legible (con espacios o minúsculas), se devuelve tal cual
 * para respetar el casing declarado.
 */
export const normalizarCodigoRubro = (codigo: string): string => {
  if (!codigo) return '';

  const looksLikeCode =
    /_/.test(codigo) || (/^[A-ZÁÉÍÓÚÜÑ0-9]+$/.test(codigo) && codigo.length > 1);

  if (!looksLikeCode) return codigo;

  return codigo
    .toLowerCase()
    .split('_')
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(' ');
};
