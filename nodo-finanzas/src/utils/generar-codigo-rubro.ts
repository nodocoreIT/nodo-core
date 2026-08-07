function quitarDiacriticos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Genera un código MAYUSCULAS_CON_GUION_BAJO a partir del nombre del rubro
 * (mismo formato que los códigos legacy, ver normalizarCodigoRubro), y lo
 * desambigua contra los códigos ya existentes agregando un sufijo numérico.
 */
export function generarCodigoRubro(nombre: string, codigosExistentes: string[]): string {
  const base =
    quitarDiacriticos(nombre)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'RUBRO';

  const existentes = new Set(codigosExistentes.map((c) => c.toUpperCase()));
  if (!existentes.has(base)) return base;

  let sufijo = 2;
  while (existentes.has(`${base}_${sufijo}`)) sufijo++;
  return `${base}_${sufijo}`;
}
