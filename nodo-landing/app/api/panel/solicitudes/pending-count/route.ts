import { createClient } from "@/lib/supabase/server";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { fetchPendingSolicitudesCount } from "@/lib/panel/pending-solicitudes-count";

export async function GET() {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  try {
    const supabase = await createClient();
    const count = await fetchPendingSolicitudesCount(supabase);
    return Response.json({ count });
  } catch (err) {
    console.error("[panel/solicitudes/pending-count] GET", err);
    return Response.json(
      { error: "Error al calcular solicitudes pendientes." },
      { status: 500 },
    );
  }
}
