import { createClient } from "@/lib/supabase/server";
import OrdersClient from "@/components/dashboard/OrdersClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createClient();
  
  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("*")
    .order("created_at", { ascending: false });

  return <OrdersClient initialOrders={pedidos || []} />;
}
