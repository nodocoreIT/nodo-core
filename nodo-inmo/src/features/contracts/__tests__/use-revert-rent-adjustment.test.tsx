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

import { useRevertRentAdjustment } from "@/features/contracts/hooks/use-revert-rent-adjustment";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useRevertRentAdjustment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractUpdateEq.mockResolvedValue({ error: null });
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

  it("restores previous rent and rolls adjustment dates back", async () => {
    const { result } = renderHook(() => useRevertRentAdjustment(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        contractId: "contract-1",
        previousRentAmount: 468000,
        lastAdjustmentDate: "2026-10-01",
        adjustmentPeriodMonths: 12,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockContractUpdateEq).toHaveBeenCalledWith("id", "contract-1");
    expect(mockPaymentsUpdateEq1).toHaveBeenCalledWith("contract_id", "contract-1");
    expect(mockPaymentsUpdateEq2).toHaveBeenCalledWith("status", "pending");
  });
});
