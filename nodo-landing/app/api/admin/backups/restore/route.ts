import { NextRequest, NextResponse } from "next/server";
import { requirePanelAdmin } from "@/lib/panel/panel-api-auth";
import { restoreSnapshot } from "@/lib/backup/snapshot-restorer";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** UUID v4 format validation. */
function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * POST /api/admin/backups/restore
 *
 * Restores a snapshot. Requires panel admin role.
 *
 * Body: { snapshot_id: string, dry_run?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePanelAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const snapshotId = String(body.snapshot_id ?? "").trim();
    const dryRun = Boolean(body.dry_run ?? false);

    if (!snapshotId || !isValidUUID(snapshotId)) {
      return jsonError("snapshot_id must be a valid UUID.", 400);
    }

    const report = await restoreSnapshot(snapshotId, dryRun, auth.userId);

    if (report.status === "failed" && report.error?.includes("not found")) {
      return NextResponse.json({ ok: false, ...report }, { status: 404 });
    }

    return NextResponse.json({ ok: report.status !== "failed", ...report });
  } catch (err) {
    console.error("[backups/restore]", err);
    return jsonError(
      err instanceof Error ? err.message : "Restore failed.",
      500,
    );
  }
}
