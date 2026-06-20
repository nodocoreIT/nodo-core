import { useState } from "react";
import { Button, Input } from "@nodocore/shared-components";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import type { InventoryWithProduct } from "../hooks/use-inventory";
import { useAdjustInventory } from "../hooks/use-inventory";

interface AdjustStockDialogProps {
  item: InventoryWithProduct;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdjustStockDialog({ item, open, onOpenChange }: AdjustStockDialogProps) {
  const [delta, setDelta] = useState<string>("");
  const [reason, setReason] = useState("");
  const adjustInventory = useAdjustInventory();

  const deltaNum = parseInt(delta, 10);
  const isValid = !isNaN(deltaNum) && deltaNum !== 0 && reason.trim().length > 0;
  const newQuantity = isNaN(deltaNum) ? item.quantity : Math.max(0, item.quantity + deltaNum);

  function handleClose(open: boolean) {
    if (!open) {
      setDelta("");
      setReason("");
    }
    onOpenChange(open);
  }

  function handleSubmit() {
    if (!isValid) return;
    adjustInventory.mutate(
      {
        inventoryId: item.id,
        productId: item.product_id,
        delta: deltaNum,
        reason: reason.trim(),
      },
      {
        onSuccess: () => handleClose(false),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-sm">
            <p className="font-medium">{item.product?.name ?? "Producto desconocido"}</p>
            {item.product?.sku && (
              <p className="text-[var(--color-muted-foreground)]">SKU: {item.product.sku}</p>
            )}
            <p className="mt-1">
              Stock actual: <span className="font-semibold">{item.quantity}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Cantidad (+ Entrada / − Salida)
            </label>
            <Input
              type="number"
              placeholder="Ej: 10 o -5"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
            />
            {!isNaN(deltaNum) && deltaNum !== 0 && (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Stock resultante:{" "}
                <span className={newQuantity === 0 ? "text-red-600 font-semibold" : "font-semibold"}>
                  {newQuantity}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Motivo <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Ej: Compra a proveedor, merma, ajuste de inventario..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || adjustInventory.isPending}
          >
            {adjustInventory.isPending ? "Guardando..." : "Confirmar ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
