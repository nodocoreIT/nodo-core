import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Producto } from "@/types";
import ProductoGrid from "@/components/productos/ProductoGrid";
import { getSiteConfig } from "@/lib/site-config/getSiteConfig";

export const metadata: Metadata = {
  title: "Buscar Productos",
  description: "Buscá entre toda nuestra colección de productos.",
};

async function buscarProductos(q: string): Promise<Producto[]> {
  if (!q || q.length < 2) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("productos")
      .select("*")
      .eq("activo", true)
      .or(`nombre.ilike.%${q}%,marca.ilike.%${q}%,descripcion.ilike.%${q}%`)
      .order("destacado", { ascending: false })
      .limit(50);
    return (data as Producto[]) || [];
  } catch {
    return [];
  }
}

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [productos, siteConfig] = await Promise.all([
    buscarProductos(q || ""),
    getSiteConfig(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
      <div className="mb-6">
        <h1 className="font-serif text-4xl text-white mb-2">Resultados de búsqueda</h1>
      </div>

      {q && q.length >= 2 ? (
        <>
          <p className="text-luxury-gray-light text-sm mb-8">
            {productos.length > 0
              ? `${productos.length} resultado${productos.length !== 1 ? "s" : ""} para: "${q.toUpperCase()}"`
              : `Sin resultados para: "${q.toUpperCase()}"`}
          </p>
          <ProductoGrid
            productos={productos}
            emptyMessage={`No encontramos productos para "${q}". Probá con el nombre de la marca u otra palabra clave.`}
            dolarEnabled={siteConfig.feature_precios_usd}
          />
        </>
      ) : (
        <div className="text-center py-16">
          <div className="text-5xl mb-4 text-luxury-gray">✦</div>
          <p className="text-luxury-gray-light">Ingresá el nombre de un producto o marca.</p>
        </div>
      )}
    </div>
  );
}
