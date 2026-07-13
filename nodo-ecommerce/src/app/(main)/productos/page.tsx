import { Metadata } from "next";
import CatalogView from "@/components/productos/CatalogView";

interface SearchParams {
  genero?: string;
  familia?: string;
  ordenar?: string;
  busqueda?: string;
  nuevo?: string;
  destacado?: string;
  q?: string;
  acordes?: string;
  notas?: string;
  marca?: string;
  categoria?: string;
  subcategoria?: string;
  seccion?: string;
}

export const metadata: Metadata = {
  title: "Catálogo de Productos de Lujo | Mi Tienda",
  description:
    "Explorá nuestro catálogo completo de productos de lujo. Femeninos, masculinos, unisex y árabes. Envío gratis.",
  alternates: {
    canonical: "/productos",
  },
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return <CatalogView searchParams={params} />;
}
