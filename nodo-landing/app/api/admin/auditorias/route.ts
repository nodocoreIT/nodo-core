import { NextResponse } from "next/server";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { AUDIT_GROUPS, AUDIT_GENERATED_AT } from "@/lib/auditorias/content.generated";

// Dynamic: depends on the caller's session (cookies), never statically cached.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/auditorias
 *
 * Returns the QA production-readiness audit content (rendered HTML per doc).
 * Gated by requirePanelTeamMember so the audit — which documents live
 * vulnerabilities including an active P0 — is only ever returned to an
 * authenticated Nodo panel team member, never from a static/public asset.
 * To tighten to admins only, swap requirePanelTeamMember → requirePanelAdmin.
 */
export async function GET() {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    ok: true,
    generatedAt: AUDIT_GENERATED_AT,
    groups: AUDIT_GROUPS,
  });
}
