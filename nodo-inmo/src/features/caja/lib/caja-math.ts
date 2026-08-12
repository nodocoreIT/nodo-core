/**
 * Pure Caja math: balance from movements, pending settlements grouped by owner,
 * and the settlement breakdown computation (TS mirror of the settle_owner SQL RPC).
 */

export interface MovementLike {
  type: string; // 'income' | 'expense'
  amount: number;
}

/** Balance = sum(income) - sum(expense). */
export function computeBalance(movements: MovementLike[]): number {
  return movements.reduce(
    (acc, m) => acc + (m.type === "income" ? m.amount : -m.amount),
    0,
  );
}

/** Totals split by type plus the resulting balance. */
export function computeTotals(movements: MovementLike[]): {
  income: number;
  expense: number;
  balance: number;
} {
  let income = 0;
  let expense = 0;
  for (const m of movements) {
    if (m.type === "income") income += m.amount;
    else expense += m.amount;
  }
  return { income, expense, balance: income - expense };
}

export interface SettlementLike {
  id: string;
  owner_id: string;
  amount: number;
  currency: string;
  status: string;
  owner?: { name: string } | null;
}

export interface PropertyGroup {
  owner_id: string;
  owner_name: string;
  property_id: string;
  property_address: string;
  currency: string;
  /** Net owner share before property-expense deductions. */
  total: number;
  /** Gross collected (rent + expenses on cobros). */
  gross_collected: number;
  /** Agency commission withheld from gross. */
  commission: number;
  settlement_ids: string[];
}

function paymentGross(payment: {
  amount: number;
  paid_amount?: number | null;
  expenses_amount?: number | null;
}): number {
  const rent = payment.paid_amount ?? payment.amount;
  return rent + (payment.expenses_amount ?? 0);
}

/**
 * Group PENDING settlements by property (and currency), summing the amount owed.
 * Settled rows are ignored.
 */
export function groupPendingByProperty(settlements: any[]): PropertyGroup[] {
  const map = new Map<string, PropertyGroup>();

  for (const s of settlements) {
    if (s.status !== "pending") continue;
    
    // Extraer property_id de las relaciones anidadas
    const propertyId = s.payment?.contract?.property?.id;
    const propertyAddress = s.payment?.contract?.property?.address ?? "Propiedad sin dirección";
    
    // Si la rendición no tiene propiedad asociada (caso raro), usamos un fallback
    const effectivePropId = propertyId ?? "no-prop";

    const gross = s.payment ? paymentGross(s.payment) : s.amount;
    const commission = gross - s.amount;

    const key = `${s.owner_id}:${effectivePropId}:${s.currency}`;
    const existing = map.get(key);
    if (existing) {
      existing.total += s.amount;
      existing.gross_collected += gross;
      existing.commission += commission;
      existing.settlement_ids.push(s.id);
    } else {
      map.set(key, {
        owner_id: s.owner_id,
        owner_name: s.owner?.name ?? "—",
        property_id: effectivePropId,
        property_address: propertyAddress,
        currency: s.currency,
        total: s.amount,
        gross_collected: gross,
        commission,
        settlement_ids: [s.id],
      });
    }
  }

  return Array.from(map.values());
}

export interface OwnerPropertyGroup {
  owner_id: string;
  owner_name: string;
  currency: string;
  /** Net owner share before property-expense deductions, summed across properties. */
  total: number;
  gross_collected: number;
  commission: number;
  settlement_ids: string[];
  properties: PropertyGroup[];
}

/**
 * Group PENDING settlements by owner (and currency), retaining a per-property
 * breakdown so the UI can show one row per owner while the PDF can still list
 * each property. Built on top of groupPendingByProperty.
 */
export function groupPendingByOwnerWithProperties(
  settlements: any[],
): OwnerPropertyGroup[] {
  const propertyGroups = groupPendingByProperty(settlements);
  const map = new Map<string, OwnerPropertyGroup>();

  for (const p of propertyGroups) {
    const key = `${p.owner_id}:${p.currency}`;
    const existing = map.get(key);
    if (existing) {
      existing.total += p.total;
      existing.gross_collected += p.gross_collected;
      existing.commission += p.commission;
      existing.settlement_ids.push(...p.settlement_ids);
      existing.properties.push(p);
    } else {
      map.set(key, {
        owner_id: p.owner_id,
        owner_name: p.owner_name,
        currency: p.currency,
        total: p.total,
        gross_collected: p.gross_collected,
        commission: p.commission,
        settlement_ids: [...p.settlement_ids],
        properties: [p],
      });
    }
  }

  return Array.from(map.values());
}

export interface OwnerGroup {
  owner_id: string;
  owner_name: string;
  currency: string;
  total: number;
  settlement_ids: string[];
}

/**
 * Group PENDING settlements by owner (and currency), summing the amount owed.
 * Settled rows are ignored.
 */
export function groupPendingByOwner(settlements: any[]): OwnerGroup[] {
  const map = new Map<string, OwnerGroup>();

  for (const s of settlements) {
    if (s.status !== "pending") continue;

    const key = `${s.owner_id}:${s.currency}`;
    const existing = map.get(key);
    if (existing) {
      existing.total += s.amount;
      existing.settlement_ids.push(s.id);
    } else {
      map.set(key, {
        owner_id: s.owner_id,
        owner_name: s.owner?.name ?? "—",
        currency: s.currency,
        total: s.amount,
        settlement_ids: [s.id],
      });
    }
  }

  return Array.from(map.values());
}

// ─── Settlement breakdown (TS mirror of the settle_owner SQL RPC — ADR-5) ────
//
// This is a DISPLAY-ONLY pure function. It is used for the pre-seal projection
// in the UI and as a regression-guarded mirror of the SQL canonical computation.
// It NEVER feeds the sealed snapshot — the RPC is the single source of truth.
//
// IMPORTANT: Keep the arithmetic in sync with the settle_owner plpgsql function.
// If SQL and TS diverge, this mirror is the bug (ADR-5, HEADLINE-2).

export interface BreakdownDeduction {
  id: string;
  amount: number;
  description: string;
  expense_date: string;
  type: string;
}

export interface BreakdownCharge {
  label: string;
  amount: number;
}

export interface SettlementBreakdown {
  gross: number;
  rent_gross?: number;
  expenses_gross?: number;
  commission_rate: number;
  commission: number;
  /** gross - commission; the owner's share before expense deductions */
  owner_share: number;
  /** rent_gross - commission; declared at the end of the statement, after all charge/deduction rows */
  rent_net_of_commission: number;
  /** Non-retained contract charge concepts (e.g. Expensas), summed by label — pass through to the owner in full. */
  charges: BreakdownCharge[];
  deductions: BreakdownDeduction[];
  /** sum of all deduction amounts */
  deduction_total: number;
  net: number;
}

/**
 * Pure projection used for pre-seal display in the UI and as the vitest mirror
 * of the SQL seal arithmetic (ADR-5). No side-effects, no network calls.
 *
 * @param payments        All payments in the settlement batch (any currency).
 * @param commissionMovements  Commission cash_movements posted by the trigger.
 * @param expenses        All chargeable expenses for the owner (any currency).
 * @param commissionRate  Effective rate for display (stored verbatim, not used to compute commission).
 * @param currency        Settlement currency — filters payments, commissions, deductions.
 */
export function computeSettlementBreakdown(
  payments: { id: string; amount: number; expenses_amount?: number; currency: string }[],
  commissionMovements: { payment_id: string; amount: number }[],
  expenses: { id: string; amount: number; currency: string; expense_date: string; description: string; type: string }[],
  commissionRate: number,
  currency: string,
  paymentCharges: {
    payment_id: string;
    concept_label: string;
    retained_by_agency: boolean;
    amount: number;
  }[] = [],
): SettlementBreakdown {
  const paymentIds = new Set(payments.map((p) => p.id));

  const inCurrency = payments.filter((p) => p.currency === currency);
  const rentGross = inCurrency.reduce((sum, p) => sum + p.amount, 0);
  const expensesGross = inCurrency.reduce(
    (sum, p) => sum + (p.expenses_amount ?? 0),
    0,
  );
  const gross = rentGross + expensesGross;

  const commission = commissionMovements
    .filter((cm) => paymentIds.has(cm.payment_id))
    .reduce((sum, cm) => sum + cm.amount, 0);

  // Non-retained concepts pass through to the owner in full — summed by
  // label, mirroring the SQL's `group by cc.label`. Retained concepts are
  // NOT included here: they already show up in `deductions` (via the
  // property_expenses row the sync trigger generates for them).
  const chargesByLabel = new Map<string, number>();
  for (const pc of paymentCharges) {
    if (!paymentIds.has(pc.payment_id) || pc.retained_by_agency || pc.amount <= 0) continue;
    chargesByLabel.set(pc.concept_label, (chargesByLabel.get(pc.concept_label) ?? 0) + pc.amount);
  }
  const charges: BreakdownCharge[] = Array.from(chargesByLabel.entries())
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // deductions = chargeable expenses matching this currency
  const deductions: BreakdownDeduction[] = expenses
    .filter((e) => e.currency === currency)
    .map((e) => ({
      id: e.id,
      amount: e.amount,
      description: e.description,
      expense_date: e.expense_date,
      type: e.type,
    }));

  // Reconcile: expensesGross (payments.expenses_amount) should always equal
  // charges + retained-concept deductions. If it doesn't — e.g. a pending
  // installment generated before a concept existed on its contract, so it
  // never got a matching payment_charges row — the gap would otherwise be
  // silently invisible even though it's still counted in gross/net. Surface
  // it as a generic line so the statement always explains 100% of the money.
  const retainedConceptTotal = deductions
    .filter((d) => d.type === "concepto_contrato")
    .reduce((sum, d) => sum + d.amount, 0);
  const chargesTotal = charges.reduce((sum, c) => sum + c.amount, 0);
  const untracked = parseFloat((expensesGross - chargesTotal - retainedConceptTotal).toFixed(2));
  if (untracked > 0.01) {
    charges.push({ label: "Expensas / Otros (sin discriminar)", amount: untracked });
  }

  const ownerShare = gross - commission;
  const rentNetOfCommission = rentGross - commission;
  const deductionTotal = deductions.reduce((sum, d) => sum + d.amount, 0);
  const net = parseFloat((ownerShare - deductionTotal).toFixed(2));

  return {
    gross,
    rent_gross: rentGross,
    expenses_gross: expensesGross,
    commission_rate: commissionRate,
    commission,
    owner_share: ownerShare,
    rent_net_of_commission: rentNetOfCommission,
    charges,
    deductions,
    deduction_total: deductionTotal,
    net,
  };
}
