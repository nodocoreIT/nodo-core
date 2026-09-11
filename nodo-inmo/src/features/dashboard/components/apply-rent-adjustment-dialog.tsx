import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@nodocore/shared-components";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { formatMoney, formatDate } from "@/features/contracts/lib/contract-labels";
import { useIPCHistory } from "@/features/ipc/hooks/use-ipc-history";
import { useICLHistory } from "@/features/ipc/hooks/use-icl-history";
import { computeIpcAdjustment } from "@/features/ipc/lib/ipc-adjustment";
import { computeIclAdjustment } from "@/features/ipc/lib/icl-adjustment";
import type { IndexAdjustmentResult } from "@/features/ipc/lib/index-adjustment-result";
import { useApplyRentAdjustment } from "@/features/contracts/hooks/use-apply-rent-adjustment";
import type { PendingIndexAdjustment } from "../hooks/use-dashboard-metrics";

interface ApplyRentAdjustmentDialogProps {
  open: boolean;
  pendingIndexAdjustment: PendingIndexAdjustment | null;
  onClose: () => void;
}

const currentMonthYearLabel = (date: Date) =>
  date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

/** Picks the right history source and calculation for the contract's adjustment index. */
function useIndexAdjustment(
  pendingIndexAdjustment: PendingIndexAdjustment | null,
): { result: IndexAdjustmentResult | null; isLoading: boolean } {
  const { data: ipcHistory = [], isLoading: isIpcLoading } = useIPCHistory();
  const { data: iclHistory = [], isLoading: isIclLoading } = useICLHistory();

  return useMemo(() => {
    if (!pendingIndexAdjustment) return { result: null, isLoading: false };

    if (pendingIndexAdjustment.adjustmentIndex === "ICL") {
      return {
        result: computeIclAdjustment(iclHistory, pendingIndexAdjustment.rentAmount),
        isLoading: isIclLoading,
      };
    }
    return {
      result: computeIpcAdjustment(ipcHistory, pendingIndexAdjustment.rentAmount),
      isLoading: isIpcLoading,
    };
  }, [pendingIndexAdjustment, ipcHistory, iclHistory, isIpcLoading, isIclLoading]);
}

export function ApplyRentAdjustmentDialog({
  open,
  pendingIndexAdjustment,
  onClose,
}: ApplyRentAdjustmentDialogProps) {
  const { result: adjustment, isLoading: isHistoryLoading } = useIndexAdjustment(
    pendingIndexAdjustment,
  );
  const applyAdjustment = useApplyRentAdjustment();
  const indexLabel = pendingIndexAdjustment?.adjustmentIndex ?? "IPC";

  async function handleConfirm() {
    if (!pendingIndexAdjustment || !adjustment?.available || adjustment.newRentAmount === null) {
      return;
    }
    await applyAdjustment.mutateAsync({
      contractId: pendingIndexAdjustment.contractId,
      newRentAmount: adjustment.newRentAmount,
      adjustmentPeriodMonths: pendingIndexAdjustment.adjustmentPeriodMonths,
    });
    onClose();
  }

  const canConfirm = !!adjustment?.available && !isHistoryLoading;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !applyAdjustment.isPending) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-navy">
            Aplicar aumento por {indexLabel}
          </DialogTitle>
          {pendingIndexAdjustment && (
            <DialogDescription>
              El último aumento por {indexLabel} se realizó el{" "}
              {formatDate(pendingIndexAdjustment.lastAdjustmentDate)}.
            </DialogDescription>
          )}
        </DialogHeader>

        {isHistoryLoading && (
          <p className="text-sm text-slate2">Buscando el {indexLabel} del mes actual…</p>
        )}

        {!isHistoryLoading && adjustment && pendingIndexAdjustment && (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            {!adjustment.available ? (
              <p className="text-sm text-slate2">
                Todavía no se publicó el {indexLabel} de {currentMonthYearLabel(new Date())}. No se
                puede aplicar el aumento hasta que esté disponible.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate2">
                    {indexLabel} de {currentMonthYearLabel(new Date())}
                  </span>
                  <span className="font-bold text-navy">+{adjustment.percentage}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate2">Alquiler actual</span>
                  <span className="text-navy">
                    {formatMoney(pendingIndexAdjustment.rentAmount, pendingIndexAdjustment.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate2">Nuevo alquiler</span>
                  <span className="font-bold text-navy">
                    {formatMoney(adjustment.newRentAmount, pendingIndexAdjustment.currency)}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {applyAdjustment.isError && (
          <p role="alert" className="text-sm text-destructive">
            No se pudo aplicar el aumento. Intentá de nuevo.
          </p>
        )}

        <DialogFooter>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || applyAdjustment.isPending}
            className="bg-brand text-white"
          >
            {applyAdjustment.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aplicando…
              </>
            ) : (
              "Aplicar aumento"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
