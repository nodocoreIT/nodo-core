import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/cron/generate-rent-installments
 *
 * Vercel Cron handler — triggered daily. Before this cron existed, the only
 * way a nodo_inmo contract got its next month's rent installment
 * (nodo_inmo.payments row) was a side effect of creating or editing that
 * contract (see nodo-inmo/src/features/contracts/components/
 * generate-payments-dialog.tsx) — an active contract nobody touches never
 * gets a new month's row, so "cobros" silently stops showing anything once
 * the last manually-generated month passes. This job closes that gap for
 * every org, every day, going forward.
 *
 * Mirrors nodo-inmo/src/features/payments/lib/generate-installments.ts
 * exactly (same due-day-from-start-date rule, same "one period per month
 * from contract start through the current month" range) — ported instead of
 * imported since nodo-inmo is a separate Vite app with no server runtime.
 *
 * Idempotent: upserts on (contract_id, period), ignoring duplicates — safe
 * to run daily or to re-run after a failure.
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 */

interface ContractRow {
  id: string;
  org_id: string;
  start_date: string;
  end_date: string;
  rent_amount: number | string;
  currency: string;
  expenses_amount: number | string | null;
}

interface InstallmentDraft {
  period: string;
  due_date: string;
  amount: number;
  currency: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function currentMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

/** Ported from nodo-inmo's generateInstallments — keep in sync if that changes. */
function generateInstallments(contract: {
  start_date: string;
  end_date: string;
  rent_amount: number;
  currency: string;
}): InstallmentDraft[] {
  const [sy, sm, sd] = contract.start_date.split("-").map(Number);
  const end = new Date(`${contract.end_date}T00:00:00Z`);
  const asOfKey = currentMonthKey(new Date());

  const drafts: InstallmentDraft[] = [];
  let year = sy;
  let month = sm;

  for (let i = 0; i < 1200; i++) {
    const periodKey = `${year}-${pad(month)}`;
    if (periodKey > asOfKey) break;

    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    if (periodStart >= end) break;

    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const dueDay = Math.min(sd, daysInMonth);

    drafts.push({
      period: `${year}-${pad(month)}-01`,
      due_date: `${year}-${pad(month)}-${pad(dueDay)}`,
      amount: contract.rent_amount,
      currency: contract.currency,
    });

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return drafts;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const db = createAdminClient("nodo_inmo");

  const { data: contracts, error: contractsError } = await db
    .from("contracts")
    .select("id, org_id, start_date, end_date, rent_amount, currency, expenses_amount")
    .eq("status", "active");

  if (contractsError) {
    return NextResponse.json({ ok: false, error: contractsError.message }, { status: 500 });
  }

  let contractsProcessed = 0;
  let installmentsInserted = 0;
  const errors: Array<{ contract_id: string; error: string }> = [];

  for (const row of (contracts ?? []) as ContractRow[]) {
    if (!row.start_date || !row.end_date || !row.rent_amount) continue;
    contractsProcessed++;

    const drafts = generateInstallments({
      start_date: row.start_date,
      end_date: row.end_date,
      rent_amount: Number(row.rent_amount),
      currency: row.currency,
    });
    if (drafts.length === 0) continue;

    const rows = drafts.map((d) => ({
      org_id: row.org_id,
      contract_id: row.id,
      period: d.period,
      due_date: d.due_date,
      amount: d.amount,
      currency: d.currency,
      status: "pending",
      expenses_amount: Number(row.expenses_amount ?? 0),
    }));

    const { error: upsertError, count } = await db
      .from("payments")
      .upsert(rows, { onConflict: "contract_id,period", ignoreDuplicates: true, count: "exact" });

    if (upsertError) {
      errors.push({ contract_id: row.id, error: upsertError.message });
      console.error(`[cron/generate-rent-installments] contract ${row.id} failed:`, upsertError.message);
      continue;
    }
    installmentsInserted += count ?? 0;
  }

  const summary = { ok: true, contractsProcessed, installmentsInserted, errors };
  console.log("[cron/generate-rent-installments] summary:", JSON.stringify(summary));
  return NextResponse.json(summary);
}
