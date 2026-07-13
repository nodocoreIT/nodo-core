import { createClient } from "@/lib/supabase/server";
import MarcasClient from "@/components/dashboard/MarcasClient";

export default async function MarcasPage() {
  const supabase = await createClient();

  const { data: marcas } = await supabase
    .from("marcas")
    .select("id, nombre, slug, logo_url, descripcion, activo")
    .order("nombre");

  return <MarcasClient marcas={marcas || []} />;
}
