"use client";

/**
 * Theme sync hook for nodo-clinica.
 * Follows the nodo-scaffold pattern: load theme_settings from Supabase on mount,
 * merge into the Zustand store. Supabase wins over localStorage so all admins
 * in the same org share the same branding.
 *
 * Table: nodo_clinica.office_settings
 * Column: theme_settings (jsonb, nullable)
 * RLS: org_id match — each doctor reads/writes only their own org's row.
 */
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { isBrowserSupabaseEnabled } from "@/lib/clinic/config";
import { useThemeStore, DEFAULT_SETTINGS, type ThemeSettings } from "./use-theme-settings";

/**
 * Loads theme_settings from office_settings on mount and merges into the Zustand
 * store. Call this inside ThemeInitializer (which must be inside AuthProvider).
 */
export function useClinicaThemeSync() {
  const { setSettings } = useThemeStore();

  useEffect(() => {
    if (!isBrowserSupabaseEnabled()) return;
    const supabase = createClient();
    supabase
      .schema("nodo_clinica")
      .from("office_settings")
      .select("theme_settings")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.theme_settings && typeof data.theme_settings === "object") {
          setSettings({ ...DEFAULT_SETTINGS, ...(data.theme_settings as Partial<ThemeSettings>) });
        }
      });
  }, [setSettings]);
}

/**
 * Persists theme_settings to office_settings in Supabase.
 * Best-effort — localStorage is the fallback if this fails.
 * RLS UPDATE policy restricts writes to the caller's own org row.
 * No .eq() needed — RLS handles row isolation.
 */
export async function saveClinicaThemeSettings(settings: ThemeSettings): Promise<void> {
  if (!isBrowserSupabaseEnabled()) return;
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await supabase.schema("nodo_clinica").from("office_settings").update({ theme_settings: settings as any });
}
