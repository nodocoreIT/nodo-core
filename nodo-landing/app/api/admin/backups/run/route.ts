import { NextRequest, NextResponse } from "next/server";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { buildSnapshot } from "@/lib/backup/snapshot-builder";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Verifies the CRON_SECRET header as an alternative to session auth. */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

/** UUID v4 format validation. */
function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * POST /api/admin/backups/run
 *
 * Triggers a manual backup for one org in one nodo.
 * Accepts panel team members OR requests authenticated with CRON_SECRET
 * (so the nightly cron can call this endpoint per-org).
 *
 * Body: { org_id: string, nodo: "nodo_inmo" }
 */
export async function POST(request: NextRequest) {
  try {
    // Allow either a valid panel session or the server-side cron secret.
    const isCron = verifyCronSecret(request);
    let userId: string | null = null;

    if (!isCron) {
      const auth = await requirePanelTeamMember();
      if (!auth.ok) return auth.response;
      userId = auth.userId;
    }

    const body = await request.json().catch(() => ({}));
    const orgId = String(body.org_id ?? "").trim();
    const nodo = String(body.nodo ?? "").trim();

    if (!orgId || !isValidUUID(orgId)) {
      return jsonError("org_id must be a valid UUID.", 400);
    }

    if (nodo !== "nodo_inmo") {
      return jsonError('nodo must be "nodo_inmo".', 400);
    }

    const result = await buildSnapshot(
      orgId,
      "nodo_inmo",
      isCron ? "cron" : "manual",
      userId,
    );

    if (!result.ok) {
      const status = result.status === 404 ? 404 : 500;
      return jsonError(result.error, status);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[backups/run]", err);
    return jsonError(
      err instanceof Error ? err.message : "Backup failed.",
      500,
    );
  }
}
