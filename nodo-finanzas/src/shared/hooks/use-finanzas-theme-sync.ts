/**
 * Theme sync hook for nodo-finanzas.
 * No auth — theme is localStorage-only (no DB round-trip needed).
 * The Zustand store in use-theme-settings already hydrates from localStorage on init.
 */
export function useFinanzasThemeSync() {
  // No-op: localStorage hydration is handled by the Zustand store directly.
}

/**
 * Stub kept for call-site compatibility.
 * With no auth/user context, theme settings are not persisted to DB.
 */
export async function saveFinanzasThemeSettings(): Promise<void> {
  // No-op: no DB write without user context.
}
