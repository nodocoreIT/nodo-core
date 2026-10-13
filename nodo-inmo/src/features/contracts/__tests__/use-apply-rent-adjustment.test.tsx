/**
 * TDD — useApplyRentAdjustment
 * Updates the contract's rent_amount + adjustment dates, then syncs the new
 * amount onto every pending installment.
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockContractUpdateEq = vi.fn();
const mockPaymentsUpdateEq2 = vi.fn();
const mockPaymentsUpdateEq1 = vi.fn();
const mockFrom = vi.fn();
const mockSchema = vi.fn();

vi.mock("@/shared/lib/supabase", () => ({
  supabase: { schema: (...a: unknown[]) => mockSchema(...a) },
}));

import { useApplyRentAdjustment } from "@/features/contracts/hooks/use-apply-rent-adjustment";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useApplyRentAdjustment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractUpdateEq.mockResolvedValue({ error: null });
    // payments: .update().eq("contract_id", id).eq("status", "pending")
    mockPaymentsUpdateEq2.mockResolvedValue({ error: null });
    mockPaymentsUpdateEq1.mockReturnValue({ eq: mockPaymentsUpdateEq2 });

    mockFrom.mockImplementation((table: string) => {
      if (table === "contracts") {
        return { update: () => ({ eq: mockContractUpdateEq }) };
      }
      if (table === "payments") {
        return { update: () => ({ eq: mockPaymentsUpdateEq1 }) };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    mockSchema.mockReturnValue({ from: mockFrom });
  });

  it("rolls the contract's rent and adjustment dates forward, then syncs pending installments", async () => {
    const { result } = renderHook(() => useApplyRentAdjustment(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        contractId: "contract-1",
        newRentAmount: 150000,
        adjustmentPeriodMonths: 6,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockContractUpdateEq).toHaveBeenCalledWith("id", "contract-1");
    expect(mockPaymentsUpdateEq1).toHaveBeenCalledWith("contract_id", "contract-1");
    expect(mockPaymentsUpdateEq2).toHaveBeenCalledWith("status", "pending");
  });

  it("propagates a contract update error without touching payments", async () => {
    mockContractUpdateEq.mockResolvedValue({ error: new Error("boom") });
    const { result } = renderHook(() => useApplyRentAdjustment(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        contractId: "contract-1",
        newRentAmount: 150000,
        adjustmentPeriodMonths: 6,
      }).catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockPaymentsUpdateEq1).not.toHaveBeenCalled();
  });
});
