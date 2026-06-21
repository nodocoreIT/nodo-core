import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getNodeDefaultTheme,
  isEmptyThemeSettings,
  type ThemeSettings,
} from "@nodocore/shared-components/lib/node-default-theme";

function inmoUnitCodeForProduct(product: "inmo" | "clinica"): string {
  return product === "inmo" ? "Inmo" : "Clínica";
}

/** Ensures nodo_inmo.org_profiles has the default theme for new dashboard clients. */
export async function seedInmoOrgProfileTheme(
  admin: SupabaseClient<any, any, any>,
  orgId: string,
  clientName: string,
  product: "inmo" | "clinica",
): Promise<void> {
  const unitCode = inmoUnitCodeForProduct(product);
  const theme = getNodeDefaultTheme(unitCode);

  const { data: existing } = await admin
    .schema("nodo_inmo")
    .from("org_profiles")
    .select("theme_settings")
    .eq("org_id", orgId)
    .maybeSingle();

  if (existing && !isEmptyThemeSettings(existing.theme_settings)) return;

  await admin.schema("nodo_inmo").from("org_profiles").upsert(
    {
      org_id: orgId,
      legal_name: clientName || null,
      theme_settings: theme as unknown as Record<string, unknown>,
    },
    { onConflict: "org_id" },
  );
}


export function finanzasThemeAppMetadata(): { theme_settings: ThemeSettings } {
  return { theme_settings: getNodeDefaultTheme("Finanzas") };
}
