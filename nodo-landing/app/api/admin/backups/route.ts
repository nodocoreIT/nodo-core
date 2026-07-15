import { NextRequest, NextResponse } from "next/server";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * GET /api/admin/backups
 *
 * Lists backup snapshots from nodo_core.backup_snapshots.
 * Query params:
 *   org_id  — filter by org (optional)
 *   nodo    — filter by nodo (optional)
 *   page    — 1-based page number (default 1)
 *   limit   — rows per page (default 20, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePanelTeamMember();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id") ?? undefined;
    const nodo = searchParams.get("nodo") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const offset = (page - 1) * limit;

    const admin = createAdminClient();

    let query = admin
      .from("backup_snapshots")
      .select(
        "id, org_id, nodo, snapshot_path, row_counts, size_bytes, status, triggered_by, created_by, created_at, restored_at, restored_by",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (orgId) {
      query = query.eq("org_id", orgId);
    }
    if (nodo) {
      query = query.eq("nodo", nodo);
    }

    const { data, error, count } = await query;

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({
      ok: true,
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    console.error("[backups GET]", err);
    return jsonError(
      err instanceof Error ? err.message : "Failed to list backups.",
      500,
    );
  }
}
