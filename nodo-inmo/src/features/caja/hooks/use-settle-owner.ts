import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { OWNER_SETTLEMENTS_QUERY_KEY } from "./use-owner-settlements";
import type { SealedBreakdown } from "@/features/caja/lib/settlement-statement-data";

export interface SettleOwnerPropertyInput {
  property_id: string;
  property_address: string;
  settlement_ids: string[];
}

export interface SettleOwnerInput {
  owner_id: string;
  owner_name: string;
  currency: string;
  properties: SettleOwnerPropertyInput[];
}

export interface SettledPropertyResult {
  property_id: string;
  property_address: string;
  breakdown: SealedBreakdown;
}

/**
 * Thrown when some properties settle successfully but a later one fails.
 * Carries the results already committed so the UI can show partial progress
 * instead of losing it.
 */
export class PartialSettleOwnerError extends Error {
  succeeded: SettledPropertyResult[];
  failedPropertyAddress: string;
  cause: unknown;

  constructor(
    succeeded: SettledPropertyResult[],
    failedPropertyAddress: string,
    cause: unknown,
  ) {
    super(
      `settle_owner: falló en "${failedPropertyAddress}" después de liquidar ${succeeded.length} propiedad(es)`,
    );
    this.succeeded = succeeded;
    this.failedPropertyAddress = failedPropertyAddress;
    this.cause = cause;
  }
}

/**
 * Settle every property of an owner via the settle_owner Postgres RPC.
 *
 * Each RPC call is transactional per-property (HEADLINE-1 / ADR-2): it writes
 * the breakdown JSONB, stamps applied_settlement_id on consumed expenses, and
 * flips status → 'settled' — all in one commit. There is no cross-property
 * transaction, so properties are settled one call at a time, in sequence.
 *
 * If a call fails partway through, the properties already settled stay settled
 * (their RPC transactions already committed) — this throws PartialSettleOwnerError
 * carrying those results so the caller can surface exactly what succeeded.
 */
export function useSettleOwner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: SettleOwnerInput,
    ): Promise<SettledPropertyResult[]> => {
      const results: SettledPropertyResult[] = [];

      for (const property of input.properties) {
        if (property.settlement_ids.length === 0) continue;

        const { data, error } = await supabase
          .schema("nodo_inmo")
          .rpc("settle_owner", {
            p_owner_id: input.owner_id,
            p_property_id: property.property_id,
            p_currency: input.currency,
            p_settlement_ids: property.settlement_ids,
          });

        if (error) {
          throw new PartialSettleOwnerError(
            results,
            property.property_address,
            error,
          );
        }

        results.push({
          property_id: property.property_id,
          property_address: property.property_address,
          breakdown: data as unknown as SealedBreakdown,
        });
      }

      return results;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: OWNER_SETTLEMENTS_QUERY_KEY });
    },
  });
}
