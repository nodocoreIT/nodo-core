import { supabase } from "@/shared/lib/supabase";
import {
  computeSettlementBreakdown,
  type OwnerPropertyGroup,
  type PropertyGroup,
} from "@/features/caja/lib/caja-math";
import {
  buildStatementData,
  combineSealedBreakdowns,
  type SealedBreakdown,
  type StatementData,
} from "@/features/caja/lib/settlement-statement-data";
import type { OrgProfileRow } from "@/features/agency-profile/hooks/use-org-profile";
import type { SettlementWithOwner } from "@/features/caja/hooks/use-owner-settlements";

/**
 * Project the pending breakdown for a single property (pre-finalizar).
 * Uses computeSettlementBreakdown — display only, not the sealed snapshot.
 */
async function computePendingPropertyBreakdown(
  group: PropertyGroup,
  settlements: SettlementWithOwner[],
): Promise<SealedBreakdown> {
  const batch = settlements.filter(
    (s) =>
      s.status === "pending" &&
      s.owner_id === group.owner_id &&
      s.currency === group.currency &&
      group.settlement_ids.includes(s.id),
  );

  const paymentIds = batch.map((s) => s.payment_id);

  const { data: payments, error: paymentsError } = await supabase
    .schema("nodo_inmo")
    .from("payments")
    .select("id, amount, expenses_amount, currency, contract_id, period")
    .in("id", paymentIds);

  if (paymentsError) throw paymentsError;

  const { data: movements, error: movementsError } = await supabase
    .schema("nodo_inmo")
    .from("cash_movements")
    .select("payment_id, amount")
    .eq("source", "commission")
    .in("payment_id", paymentIds);

  if (movementsError) throw movementsError;

  const { data: expenses, error: expensesError } = await supabase
    .schema("nodo_inmo")
    .from("property_expenses")
    .select(
      "id, amount, currency, expense_date, description, type, property_id, property:properties!property_expenses_property_id_fkey(owner_id)",
    )
    .eq("charged_to_owner", true)
    .eq("property_id", group.property_id)
    .is("applied_settlement_id", null);

  if (expensesError) throw expensesError;

  const ownerExpenses = expenses ?? [];

  const { data: charges, error: chargesError } = await supabase
    .schema("nodo_inmo")
    .from("payment_charges")
    .select("payment_id, amount, concept:contract_charge_concepts(label, retained_by_agency)")
    .in("payment_id", paymentIds);

  if (chargesError) throw chargesError;

  const breakdown = computeSettlementBreakdown(
    (payments ?? []).map((p) => ({
      id: p.id,
      amount: p.amount,
      expenses_amount: p.expenses_amount ?? 0,
      currency: p.currency,
    })),
    (movements ?? [])
      .filter((m) => m.payment_id)
      .map((m) => ({ payment_id: m.payment_id!, amount: m.amount })),
    ownerExpenses.map((e) => ({
      id: e.id,
      amount: e.amount,
      currency: e.currency ?? group.currency,
      expense_date: e.expense_date ?? "",
      description: e.description ?? "",
      type: e.type ?? "",
    })),
    0,
    group.currency,
    (charges ?? [])
      .filter((c) => c.concept)
      .map((c) => ({
        payment_id: c.payment_id,
        concept_label: (c.concept as unknown as { label: string }).label,
        retained_by_agency: (c.concept as unknown as { retained_by_agency: boolean })
          .retained_by_agency,
        amount: c.amount,
      })),
  );

  // Commission is computed on rent only (never on gross) — the displayed
  // rate must divide by rent_gross too, or it understates the real %.
  const effectiveRate =
    breakdown.rent_gross && breakdown.rent_gross > 0
      ? Math.round((breakdown.commission / breakdown.rent_gross) * 10000) / 100
      : 0;

  const cobros_detail = (payments ?? [])
    .filter((p) => p.period)
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((p) => {
      const d = new Date(p.period + "T00:00:00Z");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = d.getUTCFullYear();
      return {
        period: p.period,
        period_label: `${mm}/${yyyy}`,
        amount: p.amount,
        expenses_amount: p.expenses_amount ?? 0,
      };
    });

  return {
    ...breakdown,
    commission_rate: effectiveRate,
    currency: group.currency,
    cobro_count: batch.length,
    cobros_detail,
  };
}

/**
 * Build a projected statement for all pending settlements of an owner
 * (pre-finalizar), combining every property's breakdown into one PDF.
 */
export async function buildPendingStatementDataForOwner(
  group: OwnerPropertyGroup,
  settlements: SettlementWithOwner[],
  agency: OrgProfileRow | null,
  logoUrl: string | null,
): Promise<StatementData> {
  const perProperty = await Promise.all(
    group.properties.map(async (property) => ({
      property_id: property.property_id,
      property_address: property.property_address,
      breakdown: await computePendingPropertyBreakdown(property, settlements),
    })),
  );

  const breakdown = combineSealedBreakdowns(perProperty);

  return buildStatementData({
    breakdown,
    agency,
    logoUrl,
    ownerName: group.owner_name,
    settledDate: new Date().toISOString().slice(0, 10),
  });
}
