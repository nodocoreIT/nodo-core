import { useMemo } from "react";
import { useIPCHistory } from "@/features/ipc/hooks/use-ipc-history";
import { useICLHistory } from "@/features/ipc/hooks/use-icl-history";
import {
  computeAccumulatedIclAdjustment,
  computeAccumulatedIpcAdjustment,
} from "@/features/ipc/lib/accumulated-adjustment";
import type { IndexAdjustmentResult } from "@/features/ipc/lib/index-adjustment-result";
import type { PendingIndexAdjustment } from "./use-dashboard-metrics";

/** Picks the right history source and calculation for the contract's adjustment index. */
export function useIndexAdjustment(
  pendingIndexAdjustment: PendingIndexAdjustment | null,
): { result: IndexAdjustmentResult | null; isLoading: boolean } {
  // 36 months so the window of a late (overdue) adjustment is still covered.
  const { data: ipcHistory = [], isLoading: isIpcLoading } = useIPCHistory(36);
  const { data: iclHistory = [], isLoading: isIclLoading } = useICLHistory();

  return useMemo(() => {
    if (!pendingIndexAdjustment) return { result: null, isLoading: false };

    const { rentAmount, nextAdjustmentDate, adjustmentPeriodMonths } = pendingIndexAdjustment;
    if (pendingIndexAdjustment.adjustmentIndex === "ICL") {
      return {
        result: computeAccumulatedIclAdjustment(
          iclHistory,
          rentAmount,
          nextAdjustmentDate,
          adjustmentPeriodMonths,
        ),
        isLoading: isIclLoading,
      };
    }
    return {
      result: computeAccumulatedIpcAdjustment(
        ipcHistory,
        rentAmount,
        nextAdjustmentDate,
        adjustmentPeriodMonths,
      ),
      isLoading: isIpcLoading,
    };
  }, [pendingIndexAdjustment, ipcHistory, iclHistory, isIpcLoading, isIclLoading]);
}
