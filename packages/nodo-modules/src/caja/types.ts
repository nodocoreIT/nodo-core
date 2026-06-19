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
  payment_id?: string | null;
}

export type CreateCashMovementInput = Omit<CashMovementRow, "id" | "created_at" | "source">;
export type UpdateCashMovementInput = Partial<CreateCashMovementInput> & { id: string };

export interface CajaModuleContextValue {
  movements: CashMovementRow[];
  isLoading: boolean;
  isError: boolean;
  createMovement: (input: CreateCashMovementInput) => Promise<void>;
  updateMovement: (input: UpdateCashMovementInput) => Promise<void>;
  deleteMovement: (movement: CashMovementRow) => Promise<void>;
  isSaving: boolean;
  isDeleting?: boolean;
  formatMoney: (amount: number, currency: "ARS" | "USD") => string;
  formatDate: (date: string) => string;
  accountOptions: { value: string; label: string; currency?: "ARS" | "USD" }[];
  conceptOptions: string[];
  sourceLabels?: Record<string, string>;
  pageSize?: number;
  profitsHref?: string;
  profitsLinkLabel?: string;
  emptyMessage?: string;
  createConcepto?: (name: string) => Promise<void>;
}
