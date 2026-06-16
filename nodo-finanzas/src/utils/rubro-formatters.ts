// Función para normalizar códigos de rubros a texto legible
export const normalizarCodigoRubro = (codigo: string): string => {
  if (!codigo) return '';

  return codigo
    .toLowerCase()                    // Convertir a minúsculas
    .split('_')                      // Separar por underscores
    .map(palabra =>
      palabra.charAt(0).toUpperCase() + palabra.slice(1)  // Capitalizar primera letra
    )
    .join(' ');                      // Unir con espacios
};

// Ejemplos de uso:
// 'RESTAURACION_AUTOS' -> 'Restauracion Autos'
// 'ALIMENTACION' -> 'Alimentacion'
// 'OTROS' -> 'Otros'
