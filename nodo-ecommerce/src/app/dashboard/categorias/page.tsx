import { createClient } from "@/lib/supabase/server";
import CategoriasClient from "@/components/dashboard/CategoriasClient";

export default async function CategoriasPage() {
  const supabase = await createClient();

  const [{ data: categorias }, { data: subcategorias }] = await Promise.all([
    supabase.from("categorias").select("id, nombre, slug, orden, color, icon, activo").order("orden"),
    supabase.from("subcategorias").select("id, nombre, slug, orden, activo, categoria_id").order("orden"),
  ]);

  return (
    <CategoriasClient
      categorias={categorias || []}
      subcategorias={subcategorias || []}
    />
  );
}
