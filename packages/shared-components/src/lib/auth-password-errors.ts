/** Supabase rejects setting a password identical to the current hash. */
export function isSamePasswordAuthError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("different from the old") ||
    normalized.includes("same_password") ||
    normalized.includes("same password")
  );
}

/** Maps common Supabase Auth password errors to Spanish UX copy. */
export function mapAuthPasswordError(message: string): string {
  const normalized = message.toLowerCase();

  if (isSamePasswordAuthError(message)) {
    return "La nueva contraseña debe ser distinta a la que usás actualmente.";
  }

  if (normalized.includes("weak") || normalized.includes("pwned")) {
    return "Elegí una contraseña más segura (más larga o con más variedad de caracteres).";
  }

  if (normalized.includes("at least") && normalized.includes("character")) {
    return "La contraseña no cumple los requisitos mínimos de seguridad.";
  }

  return message;
}
