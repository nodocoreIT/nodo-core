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
import { formatMoney } from "@/features/contracts/lib/contract-labels";
import { useRevertRentAdjustment } from "@/features/contracts/hooks/use-revert-rent-adjustment";
import type { RevertibleIndexAdjustment } from "../hooks/use-dashboard-metrics";

interface RevertRentAdjustmentDialogProps {
  open: boolean;
  adjustment: RevertibleIndexAdjustment | null;
  onClose: () => void;
}

export function RevertRentAdjustmentDialog({
  open,
  adjustment,
  onClose,
}: RevertRentAdjustmentDialogProps) {
  const revertAdjustment = useRevertRentAdjustment();

  async function handleConfirm() {
    if (!adjustment) return;
    await revertAdjustment.mutateAsync({
      contractId: adjustment.contractId,
      previousRentAmount: adjustment.previousRentAmount,
      lastAdjustmentDate: adjustment.lastAdjustmentDate,
      adjustmentPeriodMonths: adjustment.adjustmentPeriodMonths,
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !revertAdjustment.isPending) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-navy">Deshacer aumento</DialogTitle>
          <DialogDescription>
            Vuelve el alquiler y las fechas de ajuste a como estaban antes de aplicar el
            índice este mes. Las expensas no se tocan.
          </DialogDescription>
        </DialogHeader>

        {adjustment && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate2">Alquiler actual</span>
              <span className="text-navy">
                {formatMoney(adjustment.currentRentAmount, adjustment.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate2">Alquiler anterior</span>
              <span className="font-bold text-navy">
                {formatMoney(adjustment.previousRentAmount, adjustment.currency)}
              </span>
            </div>
          </div>
        )}

        {revertAdjustment.isError && (
          <p role="alert" className="text-sm text-destructive">
            No se pudo deshacer el aumento. Intentá de nuevo.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={revertAdjustment.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!adjustment || revertAdjustment.isPending}
            className="bg-brand text-white"
          >
            {revertAdjustment.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deshaciendo…
              </>
            ) : (
              "Deshacer aumento"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
