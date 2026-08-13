/**
 * useSettleOwner — batch settlement across every property of an owner.
 *
 * The hook calls supabase.schema('nodo_inmo').rpc('settle_owner', {...}) once
 * per property, in sequence (the RPC is transactional per-property, there is
 * no cross-property transaction). If a call fails partway through, the
 * properties already settled stay settled — the hook must surface a
 * PartialSettleOwnerError carrying those results instead of losing them.
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockRpc = vi.fn();
const mockSchema = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    schema: (...a: unknown[]) => mockSchema(...a),
  },
}));

import { PartialSettleOwnerError, useSettleOwner } from "@/features/caja/hooks/use-settle-owner";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const breakdownA = {
  version: 2,
  currency: "ARS",
  gross: 500000,
  commission_rate: 10,
  commission: 50000,
  owner_share: 450000,
  deductions: [],
  deduction_total: 0,
  net: 450000,
  settlement_group: "group-a",
  sealed_at: "2026-06-04T12:00:00Z",
  cobro_count: 1,
  property_id: "p1",
};

const breakdownB = {
  ...breakdownA,
  gross: 300000,
  commission: 30000,
  owner_share: 270000,
  net: 270000,
  settlement_group: "group-b",
  property_id: "p2",
};

describe("useSettleOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSchema.mockReturnValue({ rpc: mockRpc, from: mockFrom });
  });

  it("calls the RPC once per property with correct params", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: breakdownA, error: null })
      .mockResolvedValueOnce({ data: breakdownB, error: null });

    const { result } = renderHook(() => useSettleOwner(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        owner_id: "o1",
        owner_name: "Juan",
        currency: "ARS",
        properties: [
          { property_id: "p1", property_address: "Depto A", settlement_ids: ["s1"] },
          { property_id: "p2", property_address: "Depto B", settlement_ids: ["s2", "s3"] },
        ],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSchema).toHaveBeenCalledWith("nodo_inmo");
    expect(mockRpc).toHaveBeenNthCalledWith(1, "settle_owner", {
      p_owner_id: "o1",
      p_property_id: "p1",
      p_currency: "ARS",
      p_settlement_ids: ["s1"],
    });
    expect(mockRpc).toHaveBeenNthCalledWith(2, "settle_owner", {
      p_owner_id: "o1",
      p_property_id: "p2",
      p_currency: "ARS",
      p_settlement_ids: ["s2", "s3"],
    });
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it("does NOT call .from('property_expenses').update() — stamping is the RPC's job", async () => {
    mockRpc.mockResolvedValue({ data: breakdownA, error: null });

    const { result } = renderHook(() => useSettleOwner(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        owner_id: "o1",
        owner_name: "Juan",
        currency: "ARS",
        properties: [{ property_id: "p1", property_address: "Depto A", settlement_ids: ["s1"] }],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).not.toHaveBeenCalledWith("property_expenses");
    expect(mockFrom).not.toHaveBeenCalledWith("owner_settlements");
  });

  it("resolves with one SettledPropertyResult per property, breakdown forwarded verbatim", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: breakdownA, error: null })
      .mockResolvedValueOnce({ data: breakdownB, error: null });

    const { result } = renderHook(() => useSettleOwner(), { wrapper });
    let returned: unknown;

    await act(async () => {
      returned = await result.current.mutateAsync({
        owner_id: "o1",
        owner_name: "Juan",
        currency: "ARS",
        properties: [
          { property_id: "p1", property_address: "Depto A", settlement_ids: ["s1"] },
          { property_id: "p2", property_address: "Depto B", settlement_ids: ["s2"] },
        ],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(returned).toEqual([
      { property_id: "p1", property_address: "Depto A", breakdown: breakdownA },
      { property_id: "p2", property_address: "Depto B", breakdown: breakdownB },
    ]);
  });

  it("surfaces a PartialSettleOwnerError with the already-settled properties when a later call fails", async () => {
    const testError = new Error("settle_owner: some settlements are missing, already settled, or already sealed");
    mockRpc
      .mockResolvedValueOnce({ data: breakdownA, error: null })
      .mockResolvedValueOnce({ data: null, error: testError });

    const { result } = renderHook(() => useSettleOwner(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        owner_id: "o1",
        owner_name: "Juan",
        currency: "ARS",
        properties: [
          { property_id: "p1", property_address: "Depto A", settlement_ids: ["s1"] },
          { property_id: "p2", property_address: "Depto B", settlement_ids: ["s2"] },
        ],
      }).catch(() => {
        // expected — asserted below via result.current.error
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as PartialSettleOwnerError;
    expect(error).toBeInstanceOf(PartialSettleOwnerError);
    expect(error.succeeded).toEqual([
      { property_id: "p1", property_address: "Depto A", breakdown: breakdownA },
    ]);
    expect(error.failedPropertyAddress).toBe("Depto B");
    // Stops after the failure — never calls the RPC for properties after the failed one
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it("skips properties with empty settlement_ids without calling the RPC for them", async () => {
    mockRpc.mockResolvedValueOnce({ data: breakdownB, error: null });

    const { result } = renderHook(() => useSettleOwner(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        owner_id: "o1",
        owner_name: "Juan",
        currency: "ARS",
        properties: [
          { property_id: "p1", property_address: "Depto A", settlement_ids: [] },
          { property_id: "p2", property_address: "Depto B", settlement_ids: ["s2"] },
        ],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("settle_owner", expect.objectContaining({ p_property_id: "p2" }));
  });

  it("returns an empty array without calling the RPC when there are no properties", async () => {
    const { result } = renderHook(() => useSettleOwner(), { wrapper });
    let returned: unknown;

    await act(async () => {
      returned = await result.current.mutateAsync({
        owner_id: "o1",
        owner_name: "Juan",
        currency: "ARS",
        properties: [],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(returned).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
