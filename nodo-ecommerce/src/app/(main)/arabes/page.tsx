import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Producto } from "@/types";
import CatalogView from "@/components/productos/CatalogView";

interface SearchParams {
  ordenar?: string;
  busqueda?: string;
}

export const metadata: Metadata = {
  title: "Productos Árabes",
  description: "Explorá nuestra selección de productos árabes.",
  alternates: { canonical: "/arabes" },
};

export default async function ArabesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  return (
    <CatalogView
      searchParams={{ ...params, categoria: "arabes" }}
      title="Productos Árabes"
    />
  );
}
