import { useState } from "react";
import { Button } from "@nodocore/shared-components";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/utils";
import type { OrderWithCustomer, OrderStatus } from "../hooks/use-orders";
import { useUpdateOrderStatus } from "../hooks/use-orders";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, getNextStatuses } from "../lib/order-utils";
import { OrderStatusBadge } from "./order-status-badge";

interface UpdateStatusDialogProps {
  order: OrderWithCustomer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateStatusDialog({ order, open, onOpenChange }: UpdateStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | null>(null);
  const [notes, setNotes] = useState("");
  const updateStatus = useUpdateOrderStatus();

  const nextStatuses = getNextStatuses(order.status) as OrderStatus[];

  function handleConfirm() {
    if (!selectedStatus) return;
    updateStatus.mutate(
      { orderId: order.id, status: selectedStatus, notes: notes || undefined },
      {
        onSuccess: () => {
          setSelectedStatus(null);
          setNotes("");
          onOpenChange(false);
        },
      },
    );
  }

  function handleClose(open: boolean) {
    if (!open) {
      setSelectedStatus(null);
      setNotes("");
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Actualizar estado del pedido</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
            <span>Estado actual:</span>
            <OrderStatusBadge status={order.status} />
          </div>

          {nextStatuses.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Este pedido no tiene estados siguientes disponibles.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">Seleccioná el nuevo estado:</p>
              <div className="flex flex-wrap gap-2">
                {nextStatuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedStatus(s)}
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border-2 transition-all",
                      ORDER_STATUS_COLORS[s] ?? "bg-gray-100 text-gray-700",
                      selectedStatus === s
                        ? "border-current ring-2 ring-offset-1 ring-current"
                        : "border-transparent opacity-70 hover:opacity-100",
                    )}
                  >
                    {ORDER_STATUS_LABELS[s] ?? s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {nextStatuses.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="status-notes" className="text-sm font-medium">
                Notas (opcional)
              </label>
              <textarea
                id="status-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Agregar comentario sobre el cambio de estado..."
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] resize-none"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedStatus || updateStatus.isPending}
          >
            {updateStatus.isPending ? "Guardando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
