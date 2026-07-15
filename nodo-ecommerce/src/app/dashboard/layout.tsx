import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createEcommerceClient } from "@/lib/supabase/ecommerce-server";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getThemeConfig } from "@/lib/theme/getThemeConfig";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth check via public schema (auth.users)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Load store config from nodo_ecommerce schema
  const db = await createEcommerceClient();
  const { data: siteConfig } = await db
    .from("site_config")
    .select("store_name, site_theme")
    .eq("org_id", user.id)
    .maybeSingle();

  const nombreCompleto = siteConfig?.store_name ?? "";
  const preferredTheme = (siteConfig?.site_theme ?? "dark") as "dark" | "light";

  const theme = await getThemeConfig();
  let enabledModules: string[] = [];
  try {
    enabledModules = JSON.parse(theme.nav_modules_enabled);
  } catch {
    enabledModules = [];
  }

  return (
    <DashboardShell
      user={user}
      nombreCompleto={nombreCompleto}
      enabledModules={enabledModules}
      preferredTheme={preferredTheme}
    >
      {children}
    </DashboardShell>
  );
}
