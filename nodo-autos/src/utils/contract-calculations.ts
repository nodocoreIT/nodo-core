import type { SalesContractData } from '@/types/contract';

export interface ContractFinancialSummary {
  salePrice: number;
  tradeInValue: number;
  balanceToPay: number;
  totalPayments: number;
  isBalanced: boolean;
  remainingBalance: number;
}

export const calculateContractFinancials = (
  contract: Partial<SalesContractData>,
): ContractFinancialSummary => {
  const salePrice = contract.agreedSalePrice || 0;
  const tradeInValue = contract.tradeInVehicle?.agreedValue || 0;
  const balanceToPay = Math.max(0, salePrice - tradeInValue);
  const totalPayments =
    contract.payments?.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;
  const remainingBalance = balanceToPay - totalPayments;
  const isBalanced = Math.abs(remainingBalance) < 0.01;

  return { salePrice, tradeInValue, balanceToPay, totalPayments, isBalanced, remainingBalance };
};

export const formatCurrency = (amount: number, currency: 'ARS' | 'USD' = 'ARS'): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

export const formatThousands = (value: number): string =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value);

export const parseDigitsToNumber = (value: string): number => {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

export const formatCurrencyInput = (value: number, currency: 'ARS' | 'USD'): string => {
  const formatted = formatThousands(value);
  return currency === 'USD' ? `US$ ${formatted}` : `$ ${formatted}`;
};
