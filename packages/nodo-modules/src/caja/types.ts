export type CashMovementType = "income" | "expense";

export interface CashMovementRow {
  id: string;
  type: CashMovementType;
  amount: number;
  currency: "ARS" | "USD";
  date: string;
  concept: string;
  category: string | null;
  source: string;
  created_at: string;
}

export type CreateCashMovementInput = Omit<CashMovementRow, "id" | "created_at" | "source">;
export type UpdateCashMovementInput = Partial<CreateCashMovementInput> & { id: string };

export interface CajaModuleContextValue {
  movements: CashMovementRow[];
  isLoading: boolean;
  isError: boolean;
  createMovement: (input: CreateCashMovementInput) => Promise<void>;
  updateMovement: (input: UpdateCashMovementInput) => Promise<void>;
  deleteMovement: (id: string) => Promise<void>;
  isSaving: boolean;
  formatMoney: (amount: number, currency: "ARS" | "USD") => string;
  formatDate: (date: string) => string;
  accountOptions: { value: string; label: string }[];
  conceptOptions: string[];
  pageSize?: number;
  profitsHref?: string;
}
