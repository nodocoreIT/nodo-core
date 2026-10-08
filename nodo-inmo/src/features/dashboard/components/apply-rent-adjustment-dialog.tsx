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
import { adjustmentWindow } from "@/features/ipc/lib/accumulated-adjustment";
import { useApplyRentAdjustment } from "@/features/contracts/hooks/use-apply-rent-adjustment";
import type { PendingIndexAdjustment } from "../hooks/use-dashboard-metrics";
import { useIndexAdjustment } from "../hooks/use-index-adjustment";

interface ApplyRentAdjustmentDialogProps {
  open: boolean;
  pendingIndexAdjustment: PendingIndexAdjustment | null;
  onClose: () => void;
}

/** "YYYY-MM" -> "septiembre de 2026". */
const monthKeyLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
};

function periodLabel({ nextAdjustmentDate, adjustmentPeriodMonths }: PendingIndexAdjustment) {
  const months = adjustmentWindow(nextAdjustmentDate, adjustmentPeriodMonths);
  const first = monthKeyLabel(months[0]);
  const last = monthKeyLabel(months[months.length - 1]);
  return months.length === 1 ? last : `${first} a ${last}`;
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
          <p className="text-sm text-slate2">Buscando el {indexLabel} acumulado…</p>
        )}

        {!isHistoryLoading && adjustment && pendingIndexAdjustment && (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            {!adjustment.available ? (
              <p className="text-sm text-slate2">
                Todavía no se puede aplicar el aumento: falta el {indexLabel} de{" "}
                {adjustment.missingMonth ? monthKeyLabel(adjustment.missingMonth) : "un mes anterior"}.
                Se publica a mediados de cada mes.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate2">
                    {indexLabel} acumulado ({periodLabel(pendingIndexAdjustment)})
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
                {pendingIndexAdjustment.expensesAmount > 0 ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate2">Expensas (sin cambio)</span>
                      <span className="text-navy">
                        {formatMoney(
                          pendingIndexAdjustment.expensesAmount,
                          pendingIndexAdjustment.currency,
                        )}
                      </span>
                    </div>
                    {adjustment.newRentAmount != null ? (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate2">Total de la cuota</span>
                        <span className="font-bold text-navy">
                          {formatMoney(
                            adjustment.newRentAmount + pendingIndexAdjustment.expensesAmount,
                            pendingIndexAdjustment.currency,
                          )}
                        </span>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-2xs text-slate2">
                    El aumento es solo sobre el alquiler. Las expensas no se modifican.
                  </p>
                )}
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
