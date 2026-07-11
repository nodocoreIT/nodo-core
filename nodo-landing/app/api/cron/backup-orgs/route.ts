import { NextRequest, NextResponse } from "next/server";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
import { buildSnapshot } from "@/lib/backup/snapshot-builder";

interface OrgRow {
  id: string;
  name: string;
}

/**
 * GET /api/cron/backup-orgs
 *
 * Vercel Cron handler — triggered nightly at 02:00 UTC.
 * Iterates all active nodo_inmo organizations and runs a backup for each.
 * Per-org failures are caught and logged but do not stop other orgs.
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const nodoAdmin = createNodoAdminClient("inmo");
  if (!nodoAdmin) {
    return NextResponse.json(
      { ok: false, error: "nodo_inmo is not configured on this server." },
      { status: 500 },
    );
  }

  // Query active nodo_inmo organizations.
  const { data: orgs, error: orgsErr } = await nodoAdmin
    .schema("shared")
    .from("organizations")
    .select("id, name")
    .eq("is_active", true)
    .eq("product", "inmo");

  if (orgsErr) {
    return NextResponse.json({ ok: false, error: orgsErr.message }, { status: 500 });
  }

  const orgList = (orgs ?? []) as OrgRow[];
  let succeeded = 0;
  let failed = 0;
  const errors: Array<{ org_id: string; error: string }> = [];

  // Sequential processing to avoid hitting Vercel function timeout.
  for (const org of orgList) {
    try {
      const result = await buildSnapshot(org.id, "nodo_inmo", "cron", null);

      if (result.ok) {
        succeeded++;
        console.log(`[cron/backup-orgs] org ${org.id} backed up → ${result.snapshot_path}`);
      } else {
        failed++;
        errors.push({ org_id: org.id, error: result.error });
        console.error(`[cron/backup-orgs] org ${org.id} failed:`, result.error);
      }
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ org_id: org.id, error: message });
      console.error(`[cron/backup-orgs] org ${org.id} threw:`, message);
    }
  }

  const summary = {
    ok: true,
    attempted: orgList.length,
    succeeded,
    failed,
    errors,
  };

  console.log("[cron/backup-orgs] summary:", JSON.stringify(summary));

  return NextResponse.json(summary);
}
