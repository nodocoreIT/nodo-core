import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Producto } from "@/types";

export const dynamic = "force-dynamic";
import ProductoForm from "@/components/dashboard/ProductoForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarProductoPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: producto } = await supabase
    .from("productos")
    .select("*")
    .eq("id", id)
    .single();

  if (!producto) notFound();

  return <ProductoForm producto={producto as Producto} isEdit />;
}
