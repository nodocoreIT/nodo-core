import {
  computeCommissionAmount,
  resolveCommissionRatePercent as resolveContractCommissionRate,
} from "@/features/contracts/lib/resolve-commission-rate";
import type { PaymentWithRelations } from "../hooks/use-payments";

export interface CobroBreakdown {
  rentAmount: number;
  expensesAmount: number;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  ownerShare: number;
}

export function resolveCommissionRatePercent(payment: PaymentWithRelations): number {
  const contract = payment.contract;
  return resolveContractCommissionRate({
    contractCommissionAmount: contract?.commission_amount,
    contractRentAmount: contract?.rent_amount,
    propertyCommissionRate: contract?.property?.commission_rate,
    ownerCommissionRate: contract?.property?.owner?.commission_rate,
  });
}

export function buildCobroBreakdown(
  payment: PaymentWithRelations,
  commissionAmountFromCaja?: number | null,
): CobroBreakdown {
  const rentAmount = payment.paid_amount ?? payment.amount;
  const expensesAmount = payment.expenses_amount ?? 0;
  const grossAmount = rentAmount + expensesAmount;
  const commissionRate = resolveCommissionRatePercent(payment);

  const commissionAmount =
    commissionAmountFromCaja != null
      ? commissionAmountFromCaja
      : computeCommissionAmount(commissionRate, rentAmount, expensesAmount);

  return {
    rentAmount,
    expensesAmount,
    grossAmount,
    commissionRate,
    commissionAmount,
    ownerShare: grossAmount - commissionAmount,
  };
}
