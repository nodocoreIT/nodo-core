/**
 * TDD — PaymentsList
 * Tests: renders rows with derived status, filters by status, marks paid,
 * and shows the empty state.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { useSearchStore } from "@/shared/search/use-search-store";

const mockUsePayments = vi.fn();
vi.mock("@/features/payments/hooks/use-payments", () => ({
  usePayments: () => mockUsePayments(),
  PAYMENTS_QUERY_KEY: ["nodo_inmo", "payments"],
}));

vi.mock("@/features/payments/hooks/use-update-payment", () => ({
  useUpdatePayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/features/payments/hooks/use-delete-payment", () => ({
  useDeletePayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePayments: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAnnulPayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  assignCommissionAccount: vi.fn(),
}));

vi.mock("@nodocore/shared-components", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nodocore/shared-components")>();
  return {
    ...actual,
    useAuth: () => ({ orgId: "org-1" }),
    // Radix Select triggers an infinite setState loop in jsdom due to missing
    // layout engine. Replace with native equivalents for all dialog tests.
    Select: ({ children, onValueChange, defaultValue }: React.PropsWithChildren<{ onValueChange?: (v: string) => void; defaultValue?: string }>) => (
      <select defaultValue={defaultValue} onChange={(e) => onValueChange?.(e.target.value)}>
        {children}
      </select>
    ),
    SelectTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
    SelectItem: ({ value, children }: React.PropsWithChildren<{ value: string }>) => (
      <option value={value}>{children}</option>
    ),
  };
});

vi.mock("@/features/agency-profile/hooks/use-org-profile", () => ({
  useOrgProfile: () => ({ data: null }),
}));

// PaymentCollectDialog uses Radix Dialog + Select which both trigger an
// infinite setState loop in jsdom (missing layout engine). Stub with a
// minimal version that covers what the list-level tests need to assert.
vi.mock("@/features/payments/components/payment-collect-dialog", () => ({
  PaymentCollectDialog: ({ open, paymentId }: { open: boolean; paymentId: string | null }) => {
    if (!open || !paymentId) return null;
    return (
      <div role="dialog">
        <h2>Registrar cobro</h2>
      </div>
    );
  },
}));

vi.mock("@/shared/hooks/use-cash-accounts", () => ({
  useCashAccounts: () => ({
    accounts: [{ id: "cash-ars", label: "Efectivo Pesos (ARS)", currency: "ARS" }],
  }),
}));

import { PaymentsList } from "@/features/payments/components/payments-list";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

// Fixtures use extreme dates so "overdue" is deterministic regardless of today.
const PAID = {
  id: "p-paid", period: "2026-01-01", due_date: "2026-01-10", amount: 250000,
  currency: "ARS", status: "paid", paid_date: "2026-01-08", paid_amount: 250000,
  contract: { property: { address: "Lavalle 100" }, tenant: { name: "Juan" } },
};
const PENDING = {
  id: "p-pend", period: "2999-02-01", due_date: "2999-02-10", amount: 180000,
  currency: "ARS", status: "pending", paid_date: null, paid_amount: null,
  contract: { property: { address: "Mitre 200" }, tenant: { name: "Ana" } },
};
const OVERDUE = {
  id: "p-over", period: "2020-03-01", due_date: "2020-03-10", amount: 90000,
  currency: "ARS", status: "pending", paid_date: null, paid_amount: null,
  contract: { property: { address: "Callao 500" }, tenant: { name: "Luis" } },
};
const PARTIAL = {
  id: "p-part", period: "2999-03-01", due_date: "2999-03-10", amount: 150000,
  currency: "ARS", status: "pending", paid_date: null, paid_amount: 50000,
  contract: { property: { address: "Belgrano 300" }, tenant: { name: "Maria" } },
};
const PARTIAL_OVERDUE = {
  id: "p-part-over", period: "2020-04-01", due_date: "2020-04-10", amount: 150000,
  currency: "ARS", status: "pending", paid_date: null, paid_amount: 50000,
  contract: { property: { address: "Rivadavia 400" }, tenant: { name: "Pedro" } },
};

describe("PaymentsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSearchStore.setState({ query: "" });
    mockUsePayments.mockReturnValue({
      data: [PAID, PENDING, OVERDUE, PARTIAL, PARTIAL_OVERDUE],
      isLoading: false,
      isError: false,
    });
  });

  it("renders rows with derived status badges", () => {
    render(<PaymentsList />, { wrapper });
    expect(screen.getByText("Lavalle 100")).toBeInTheDocument();
    expect(screen.getByText("Mitre 200")).toBeInTheDocument();
    expect(screen.getByText("Callao 500")).toBeInTheDocument();
    expect(screen.getByText("Belgrano 300")).toBeInTheDocument();
    expect(screen.getByText("Rivadavia 400")).toBeInTheDocument();
    expect(screen.getByText("Cobrada")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Vencida")).toBeInTheDocument();
    expect(screen.getAllByText("Parcial")).toHaveLength(2);
    expect(screen.getAllByText(/Restan \$ 100\.000/)).toHaveLength(2);
  });

  it("filters to only overdue installments", async () => {
    render(<PaymentsList />, { wrapper });
    await userEvent.click(screen.getByRole("button", { name: "Vencidas" }));
    expect(screen.getByText("Callao 500")).toBeInTheDocument();
    expect(screen.getByText("Rivadavia 400")).toBeInTheDocument(); // Overdue partial
    expect(screen.queryByText("Lavalle 100")).not.toBeInTheDocument();
    expect(screen.queryByText("Mitre 200")).not.toBeInTheDocument();
    expect(screen.queryByText("Belgrano 300")).not.toBeInTheDocument(); // Non-overdue partial
  });

  it("opens the collect dialog when Cobrar is clicked", async () => {
    render(<PaymentsList />, { wrapper });
    await userEvent.click(screen.getByRole("button", { name: "Pendientes" }));
    await userEvent.click(screen.getAllByRole("button", { name: /registrar cobro/i })[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Registrar cobro")).toBeInTheDocument();
  });

  it("does not show a Cobrar action on paid installments", async () => {
    render(<PaymentsList />, { wrapper });
    await userEvent.click(screen.getByRole("button", { name: "Cobradas" }));
    const table = screen.getByRole("table");
    expect(
      within(table).queryByRole("button", { name: /registrar cobro/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no installments", () => {
    mockUsePayments.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<PaymentsList />, { wrapper });
    expect(screen.getByText(/todavía no hay cuotas generadas/i)).toBeInTheDocument();
  });
});
