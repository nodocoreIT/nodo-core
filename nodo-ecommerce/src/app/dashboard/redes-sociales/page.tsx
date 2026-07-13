import { createClient } from "@/lib/supabase/server";
import RedesSocialesClient from "@/components/dashboard/RedesSocialesClient";

export default async function RedesSocialesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("configuracion")
    .select("clave, valor")
    .in("clave", ["instagram", "whatsapp", "facebook", "tiktok"]);

  const config: Record<string, string> = {};
  (data || []).forEach((row: { clave: string; valor: string }) => {
    config[row.clave] = row.valor;
  });

  return <RedesSocialesClient config={config} />;
}
