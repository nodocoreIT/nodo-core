import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { listNodoUsers } from "@/lib/panel/nodo-users-list";

export async function GET() {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  try {
    const users = await listNodoUsers();
    return Response.json({ users });
  } catch (err) {
    console.error("[admin/nodo-users] GET", err);
    return Response.json({ error: "Error al cargar usuarios de nodo." }, { status: 500 });
  }
}
