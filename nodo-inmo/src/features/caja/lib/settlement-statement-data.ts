/**
 * Pure data-mapping / prop-builder for the settlement statement PDF.
 *
 * This module is the single boundary between the DB data and the PDF document.
 * It maps raw Supabase rows + breakdown JSONB into a typed object that
 * settlement-statement-document.tsx renders verbatim (HEADLINE-2 / ADR-5).
 *
 * No network calls, no side-effects — pure function.
 */

import type { BreakdownCharge, SettlementBreakdown } from "@/features/caja/lib/caja-math";
import type { OrgProfileRow } from "@/features/agency-profile/hooks/use-org-profile";

// The extended breakdown as it comes from the sealed DB snapshot.
// `SettlementBreakdown` already has: gross, commission_rate, commission,
// owner_share, deductions, deduction_total, net.
// The sealed JSONB also carries: currency, version, sealed_at, settlement_group, cobro_count.
export interface CobroDetail {
  period: string;
  period_label: string;
  amount: number;
  expenses_amount: number;
}

export interface SealedBreakdown extends SettlementBreakdown {
  currency: string;
  version?: number;
  sealed_at?: string;
  settlement_group?: string;
  cobro_count?: number;
  cobros_detail?: CobroDetail[];
  /** Present when the statement combines more than one property for the same owner. */
  properties_detail?: PropertyBreakdownDetail[];
}

export interface PropertyBreakdownDetail {
  property_id: string;
  property_address: string;
  breakdown: SealedBreakdown;
}

export interface StatementData {
  breakdown: SealedBreakdown;
  currency: string;
  agencyName: string;
  address: string;
  cuit: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  ownerName: string;
  settledDate: string;
}

export interface BuildStatementDataInput {
  breakdown: SealedBreakdown;
  agency: OrgProfileRow | null;
  logoUrl: string | null;
  ownerName: string;
  settledDate: string;
}

/**
 * Build the prop object that drives the PDF document.
 *
 * Reads breakdown verbatim — no recomputation (HEADLINE-2).
 * Handles null agency gracefully (R-A22 / R-C2) — every field defaults to "".
 */
export function buildStatementData(input: BuildStatementDataInput): StatementData {
  const { breakdown, agency, logoUrl, ownerName, settledDate } = input;

  return {
    breakdown,
    currency: breakdown.currency,
    agencyName: agency?.legal_name ?? "",
    address: agency?.address ?? "",
    cuit: agency?.cuit ?? "",
    phone: agency?.phone ?? "",
    email: agency?.email ?? "",
    logoUrl: logoUrl ?? null,
    ownerName,
    settledDate,
  };
}

/**
 * Combine per-property sealed breakdowns into a single statement-level
 * breakdown for an owner with more than one property. Sums the totals and
 * keeps each property's own breakdown in `properties_detail` so the PDF can
 * render a section per property (HEADLINE-2 stays true per-property — this
 * combiner only sums the already-sealed/projected numbers, it never
 * recomputes them).
 *
 * If given a single item, returns that item's breakdown as-is (no
 * properties_detail) so the existing single-property PDF layout is untouched.
 */
export function combineSealedBreakdowns(
  items: PropertyBreakdownDetail[],
): SealedBreakdown {
  if (items.length === 1) return items[0].breakdown;

  const currency = items[0]?.breakdown.currency ?? "";
  const chargesByLabel = new Map<string, number>();

  const combined = items.reduce<SealedBreakdown>(
    (acc, item) => {
      const b = item.breakdown;
      acc.gross += b.gross;
      acc.rent_gross = (acc.rent_gross ?? 0) + (b.rent_gross ?? 0);
      acc.expenses_gross = (acc.expenses_gross ?? 0) + (b.expenses_gross ?? 0);
      acc.commission += b.commission;
      acc.owner_share += b.owner_share;
      acc.rent_net_of_commission += b.rent_net_of_commission;
      acc.deductions.push(...b.deductions);
      acc.deduction_total += b.deduction_total;
      acc.net += b.net;
      acc.cobro_count = (acc.cobro_count ?? 0) + (b.cobro_count ?? 0);
      for (const c of b.charges) {
        chargesByLabel.set(c.label, (chargesByLabel.get(c.label) ?? 0) + c.amount);
      }
      acc.properties_detail!.push({
        property_id: item.property_id,
        property_address: item.property_address,
        breakdown: b,
      });
      return acc;
    },
    {
      currency,
      gross: 0,
      rent_gross: 0,
      expenses_gross: 0,
      commission_rate: 0,
      commission: 0,
      owner_share: 0,
      rent_net_of_commission: 0,
      charges: [],
      deductions: [],
      deduction_total: 0,
      net: 0,
      cobro_count: 0,
      properties_detail: [],
    },
  );

  const charges: BreakdownCharge[] = Array.from(chargesByLabel.entries())
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Blended rate across all properties — each PropertySection displays its
  // own property's rate instead, but this keeps the combined value honest
  // for any other reader of the merged breakdown.
  const commissionRate =
    combined.rent_gross && combined.rent_gross > 0
      ? Math.round((combined.commission / combined.rent_gross) * 10000) / 100
      : 0;

  return { ...combined, charges, commission_rate: commissionRate };
}

/**
 * Slugify owner name for use in a filename.
 * "Juan Pérez" → "juan-perez"
 */
export function slugifyOwnerName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
