import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@nodocore/shared-components";
import { Input } from "@nodocore/shared-components";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { useAuth } from "@nodocore/shared-components";
import { useQueryClient } from "@tanstack/react-query";
import { syncContractInstallments } from "@/features/payments/lib/sync-contract-installments";
import { PAYMENTS_QUERY_KEY } from "@/features/payments/hooks/use-payments";
import { CONTRACTS_QUERY_KEY } from "@/features/contracts/hooks/use-contracts";

type GenerateOption = "from_start" | "from_date" | "none";

interface GeneratePaymentsDialogProps {
  open: boolean;
  contract: {
    id: string;
    start_date: string;
    end_date: string;
    rent_amount: number;
    currency: string;
    status: string;
    expenses_amount: number;
  } | null;
  onClose: () => void;
}

export function GeneratePaymentsDialog({
  open,
  contract,
  onClose,
}: GeneratePaymentsDialogProps) {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const [option, setOption] = useState<GenerateOption>("from_start");
  const [fromDate, setFromDate] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!contract || !orgId) return;
    setError(null);

    if (option === "none") {
      await queryClient.invalidateQueries({ queryKey: CONTRACTS_QUERY_KEY });
      onClose();
      return;
    }

    setIsPending(true);
    try {
      const from = option === "from_date" ? fromDate : undefined;
      await syncContractInstallments(orgId, contract, from);
      await queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: CONTRACTS_QUERY_KEY });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudieron generar las cuotas. Intentá de nuevo.",
      );
    } finally {
      setIsPending(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isPending) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-navy">Generar cuotas pendientes</DialogTitle>
          <DialogDescription>
            El contrato fue guardado. Elegí cómo generar las cuotas de alquiler pendientes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-mist/30">
            <input
              type="radio"
              name="generate-option"
              value="from_start"
              checked={option === "from_start"}
              onChange={() => setOption("from_start")}
              className="mt-0.5 h-4 w-4 text-brand"
            />
            <div>
              <p className="text-sm font-medium text-navy">Desde el inicio del contrato</p>
              <p className="text-xs text-slate2">
                Genera todas las cuotas desde {contract?.start_date ?? "la fecha de inicio"} hasta
                hoy.
              </p>
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-mist/30">
            <input
              type="radio"
              name="generate-option"
              value="from_date"
              checked={option === "from_date"}
              onChange={() => setOption("from_date")}
              className="mt-0.5 h-4 w-4 text-brand"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-navy">Desde una fecha específica</p>
              <p className="text-xs text-slate2 mb-2">
                Elegí a partir de qué mes generar las cuotas.
              </p>
              {option === "from_date" && (
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  min={contract?.start_date}
                  max={today}
                  className="max-w-[180px]"
                />
              )}
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-mist/30">
            <input
              type="radio"
              name="generate-option"
              value="none"
              checked={option === "none"}
              onChange={() => setOption("none")}
              className="mt-0.5 h-4 w-4 text-brand"
            />
            <div>
              <p className="text-sm font-medium text-navy">No generar por ahora</p>
              <p className="text-xs text-slate2">
                Las cuotas se irán generando automáticamente mes a mes.
              </p>
            </div>
          </label>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            onClick={handleConfirm}
            disabled={isPending || (option === "from_date" && !fromDate)}
            className="bg-brand text-white"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando…
              </>
            ) : option === "none" ? (
              "Continuar"
            ) : (
              "Generar cuotas"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
