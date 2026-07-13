import { createClient } from "@/lib/supabase/server";
import { createEcommerceClient } from "@/lib/supabase/ecommerce-server";
import { Producto } from "@/types";
import DashboardClient from "@/components/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const db = await createEcommerceClient();

  const [
    { data: rawProductos },
    { data: categorias },
    { data: proveedores },
  ] = await Promise.all([
    db.from("products").select("*").eq("org_id", user!.id).order("created_at", { ascending: false }),
    db.from("categories").select("id, name").eq("org_id", user!.id),
    db.from("providers").select("id, name").eq("org_id", user!.id),
  ]);

  const catMap = new Map(categorias?.map((c) => [c.id, c.name]) ?? []);
  const provMap = new Map(proveedores?.map((p) => [p.id, p.name]) ?? []);

  const productos = ((rawProductos as any[]) ?? []).map((p) => ({
    ...p,
    // Bridge: map new schema field names to the names DashboardClient expects
    nombre: p.name,
    precio_venta: p.sale_price,
    precio_costo: p.cost_price,
    imagen_url: p.image_url,
    activo: p.active,
    destacado: p.featured,
    categoria: p.category_id ? (catMap.get(p.category_id) ?? "") : "",
    proveedores: p.provider_id ? { nombre: provMap.get(p.provider_id) ?? null } : null,
  }));

  return <DashboardClient productos={productos as Producto[]} />;
}
