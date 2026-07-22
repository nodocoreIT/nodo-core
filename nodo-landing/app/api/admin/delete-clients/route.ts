import { NextRequest, NextResponse } from "next/server";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { deleteClientsWithAccessRevoke } from "@/lib/registration/revoke-client-access";

export async function POST(request: NextRequest) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const rawIds = body.ids ?? body.client_ids ?? [];

  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return NextResponse.json(
      { error: "ids es obligatorio (array de client_id)." },
      { status: 400 },
    );
  }

  const clientIds = rawIds
    .map((id: unknown) => String(id ?? "").trim())
    .filter(Boolean);

  if (clientIds.length === 0) {
    return NextResponse.json({ error: "Ningún id válido." }, { status: 400 });
  }

  const result = await deleteClientsWithAccessRevoke(clientIds);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, partial: result.partial },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, deleted: result.deleted });
}
