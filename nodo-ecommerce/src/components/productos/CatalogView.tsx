import { createClient } from "@/lib/supabase/server";
import { Producto } from "@/types";
import ProductoGrid from "@/components/productos/ProductoGrid";
import FiltrosCatalogo from "@/components/productos/FiltrosCatalogo";
import { getSiteConfig } from "@/lib/site-config/getSiteConfig";

interface SearchParams {
  ordenar?: string;
  busqueda?: string;
  nuevo?: string;
  destacado?: string;
  q?: string;
  marca?: string;
  categoria?: string;
  subcategoria?: string;
  seccion?: string;
  tipo?: string;
}

async function getProductos(params: SearchParams): Promise<Producto[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("productos")
      .select("*")
      .eq("activo", true);

    if (params.nuevo === "true") query = query.eq("nuevo", true);
    if (params.destacado === "true") query = query.eq("destacado", true);
    if (params.marca) query = query.eq("marca", params.marca);

    // Filtro por subcategoría (via slug → id)
    if (params.subcategoria) {
      const { data: sub } = await supabase
        .from("subcategorias")
        .select("id")
        .eq("slug", params.subcategoria)
        .single();
      if (sub) {
        query = query.eq("subcategoria_id", sub.id);
      }
    } else if (params.categoria) {
      // Resolver categoría por slug
      const { data: cat } = await supabase
        .from("categorias")
        .select("id")
        .eq("slug", params.categoria)
        .single();

      if (cat) {
        // Obtener subcategorías de esta categoría
        const { data: subs } = await supabase
          .from("subcategorias")
          .select("id")
          .eq("categoria_id", cat.id);

        const subIds = (subs ?? []).map((s) => s.id);

        if (subIds.length > 0) {
          // Productos asignados a la categoría O a cualquiera de sus subcategorías
          query = query.or(
            `categoria_id.eq.${cat.id},subcategoria_id.in.(${subIds.join(",")})`
          );
        } else {
          // Categoría sin subcategorías: filtrar solo por categoria_id
          query = query.eq("categoria_id", cat.id);
        }
      } else {
        // Fallback: categoría no encontrada por slug, buscar en campo texto
        query = query.ilike("categoria", `%${params.categoria.replace(/-/g, " ")}%`);
      }
    }

    if (params.seccion === "bienestar") {
      query = query.ilike("categoria", "%bienestar%");
    }

    if (params.seccion === "aromatizantes") {
      query = query.ilike("categoria", "%aromatizantes%");
    }

    if (params.seccion === "cuidados-piel") {
      query = query.ilike("categoria", "%piel%");
    }

    if (params.busqueda || params.q) {
      const term = params.busqueda || params.q || "";
      query = query.or(
        `nombre.ilike.%${term}%,marca.ilike.%${term}%,descripcion.ilike.%${term}%`,
      );
    }

    switch (params.ordenar) {
      case "precio_asc":
        query = query.order("precio_venta", { ascending: true });
        break;
      case "precio_desc":
        query = query.order("precio_venta", { ascending: false });
        break;
      case "nombre":
        query = query.order("nombre", { ascending: true });
        break;
      default:
        query = query
          .order("destacado", { ascending: false })
          .order("created_at", { ascending: false });
    }

    const { data } = await query.limit(100);
    return (data as Producto[]) || [];
  } catch {
    return [];
  }
}

export default async function CatalogView({
  searchParams,
  title,
}: {
  searchParams: SearchParams;
  title?: string;
}) {
  const supabase = await createClient()

  const [productos, siteConfig] = await Promise.all([
    getProductos(searchParams),
    getSiteConfig(),
  ])

  // Fetch subcategories of the current category for the filter bar
  let subcategoriasFiltro: { id: string; nombre: string; slug: string }[] = []
  if (searchParams.categoria) {
    const { data: cat } = await supabase
      .from('categorias')
      .select('id')
      .eq('slug', searchParams.categoria)
      .single()
    if (cat) {
      const { data: subs } = await supabase
        .from('subcategorias')
        .select('id, nombre, slug')
        .eq('categoria_id', cat.id)
        .eq('activo', true)
        .order('orden')
      subcategoriasFiltro = subs ?? []
    }
  }

  const displayTitle = title || (searchParams.nuevo === "true"
    ? "Novedades"
    : searchParams.destacado === "true"
      ? "Productos Destacados"
      : searchParams.categoria
        ? searchParams.categoria.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())
        : searchParams.seccion === "bienestar"
          ? "Línea Bienestar"
          : searchParams.seccion === "cuidados-piel"
            ? "Cuidados de la Piel"
            : "Catálogo de Productos");

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="px-4 sm:px-6 lg:px-8 mb-10">
        <p className="text-gold text-xs tracking-[0.3em] uppercase mb-2">
          Catálogo
        </p>
        <h1 className="font-serif text-4xl md:text-5xl text-white mb-4">
          {displayTitle}
        </h1>
        <p className="text-luxury-gray-light text-sm">
          {productos.length}{" "}
          {"producto"}
          {productos.length !== 1 ? "s" : ""} {productos.length === 1 ? "encontrado" : "encontrados"} en{" "}
          {searchParams.categoria
            ? searchParams.categoria
                .replace(/-/g, " ")
                .replace(/\b\w/g, (l) => l.toUpperCase())
            : searchParams.seccion === "bienestar"
              ? "toda la categoría Bienestar"
              : searchParams.seccion === "aromatizantes"
                ? "toda la categoría Aromatizantes"
                : searchParams.seccion === "cuidados-piel"
                  ? "toda la categoría Cuidados de la Piel"
                  : "el catálogo"}
        </p>
      </div>

      {/* Filtros Superiores (Horizontales) */}
      <div className="px-4 sm:px-6 lg:px-8">
        <FiltrosCatalogo
          activeParams={searchParams as Record<string, string | undefined>}
          subcategorias={subcategoriasFiltro}
        />
      </div>

      <div className="px-4 sm:px-6 lg:px-8">
        <ProductoGrid
          productos={productos}
          emptyMessage="No encontramos productos con ese filtro. Probá con otras opciones."
          dolarEnabled={siteConfig.feature_precios_usd}
        />
      </div>
    </div>
  );
}
