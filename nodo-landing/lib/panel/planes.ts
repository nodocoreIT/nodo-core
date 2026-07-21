import type { FormSelectOption } from "@nodocore/shared-components";

export type NodePlan = {
  id: string;
  unit_code: string;
  code: string;
  label: string;
  price_monthly: number;
  price_annual_monthly: number;
  currency: string;
  sort_order: number;
  is_active: boolean;
};

/** Total annual price when billed upfront (2 months free → pay for 10 of 12). */
export function annualTotalFromMonthly(monthly: number): number {
  return Math.round(monthly * 10 * 100) / 100;
}

export function getPlansForUnit(planes: NodePlan[], unitCode: string): NodePlan[] {
  const code = unitCode.trim().toLowerCase();
  return planes
    .filter((plan) => plan.unit_code.trim().toLowerCase() === code && plan.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.price_monthly - b.price_monthly);
}

export function defaultPlanCodeForUnit(planes: NodePlan[], unitCode: string): string {
  return getPlansForUnit(planes, unitCode)[0]?.code ?? "";
}

export function normalizePlanCode(
  planes: NodePlan[],
  unitCode: string,
  plan: string | null,
): string {
  const raw = (plan ?? "").trim().toLowerCase();
  if (!raw) return "";

  const options = getPlansForUnit(planes, unitCode);
  const exact = options.find((option) => option.code.toLowerCase() === raw);
  if (exact) return exact.code;

  const byLabel = options.find(
    (option) =>
      option.label.toLowerCase() === raw ||
      option.label.toLowerCase().startsWith(raw) ||
      raw.startsWith(option.label.toLowerCase()),
  );
  if (byLabel) return byLabel.code;

  const fuzzy = options.find(
    (option) => raw.includes(option.code.toLowerCase()) || option.code.toLowerCase().includes(raw),
  );
  return fuzzy?.code ?? raw;
}

export function formatPlanOptionLabel(plan: NodePlan): string {
  return `${plan.label} — ${plan.currency} ${plan.price_monthly}/mes`;
}

export function getPlanSelectOptions(planes: NodePlan[], unitCode: string): FormSelectOption[] {
  return getPlansForUnit(planes, unitCode).map((plan) => ({
    value: plan.code,
    label: formatPlanOptionLabel(plan),
  }));
}
