import { useState } from "react";
import { Button } from "@nodocore/shared-components";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useOrder } from "../hooks/use-orders";
import type { OrderWithCustomer } from "../hooks/use-orders";
import { OrderStatusBadge } from "./order-status-badge";
import { UpdateStatusDialog } from "./update-status-dialog";
import { formatPrice } from "../lib/order-utils";

interface OrderDetailPanelProps {
  order: OrderWithCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderDetailPanel({ order, open, onOpenChange }: OrderDetailPanelProps) {
  const [updateStatusOpen, setUpdateStatusOpen] = useState(false);
  const { data: detail, isLoading } = useOrder(order?.id ?? null);

  if (!order) return null;

  const customer = detail?.customer;
  const items = detail?.order_items ?? [];
  const history = [...(detail?.order_status_history ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>Pedido #{order.order_number}</span>
              <OrderStatusBadge status={order.status} />
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              Cargando...
            </div>
          ) : (
            <div className="space-y-6 overflow-y-auto">
              {/* Order header */}
              <div className="grid grid-cols-2 gap-4 rounded-md border border-[var(--color-border)] p-4 text-sm">
                <div>
                  <p className="font-medium text-[var(--color-muted-foreground)]">Fecha</p>
                  <p>{new Date(order.created_at).toLocaleDateString("es-AR", { dateStyle: "long" })}</p>
                </div>
                <div>
                  <p className="font-medium text-[var(--color-muted-foreground)]">Total</p>
                  <p className="text-lg font-semibold">{formatPrice(order.total)}</p>
                </div>
                {order.notes && (
                  <div className="col-span-2">
                    <p className="font-medium text-[var(--color-muted-foreground)]">Notas</p>
                    <p>{order.notes}</p>
                  </div>
                )}
              </div>

              {/* Customer info */}
              {customer && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Cliente</h3>
                  <div className="rounded-md border border-[var(--color-border)] p-4 text-sm space-y-1">
                    <p className="font-medium">
                      {customer.first_name} {customer.last_name}
                    </p>
                    {customer.email && <p className="text-[var(--color-muted-foreground)]">{customer.email}</p>}
                    {customer.phone && <p className="text-[var(--color-muted-foreground)]">{customer.phone}</p>}
                  </div>
                </div>
              )}

              {/* Order items */}
              {items.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Artículos</h3>
                  <div className="rounded-md border border-[var(--color-border)] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--color-muted)]">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Producto</th>
                          <th className="px-4 py-2 text-right font-medium">Cant.</th>
                          <th className="px-4 py-2 text-right font-medium">Precio unit.</th>
                          <th className="px-4 py-2 text-right font-medium">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id} className="border-t border-[var(--color-border)]">
                            <td className="px-4 py-2">
                              <p>{item.product_name}</p>
                              {item.variant_label && (
                                <p className="text-xs text-[var(--color-muted-foreground)]">
                                  {item.variant_label}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">{item.quantity}</td>
                            <td className="px-4 py-2 text-right">{formatPrice(item.unit_price)}</td>
                            <td className="px-4 py-2 text-right font-medium">{formatPrice(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-[var(--color-border)] bg-[var(--color-muted)]">
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-right font-semibold">Total</td>
                          <td className="px-4 py-2 text-right font-bold">{formatPrice(order.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Status timeline */}
              {history.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Historial de estados</h3>
                  <ol className="space-y-3">
                    {history.map((entry, idx) => (
                      <li key={entry.id} className="flex gap-3 text-sm">
                        <div className="flex flex-col items-center">
                          <div
                            className={`h-2.5 w-2.5 rounded-full mt-0.5 ${
                              idx === history.length - 1
                                ? "bg-[var(--color-primary)]"
                                : "bg-[var(--color-border)]"
                            }`}
                          />
                          {idx < history.length - 1 && (
                            <div className="w-px flex-1 bg-[var(--color-border)] my-1" />
                          )}
                        </div>
                        <div className="pb-3">
                          <OrderStatusBadge status={entry.status} />
                          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                            {new Date(entry.created_at).toLocaleString("es-AR")}
                          </p>
                          {entry.notes && (
                            <p className="mt-0.5 text-xs">{entry.notes}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end pt-2">
                <Button onClick={() => setUpdateStatusOpen(true)}>
                  Actualizar estado
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {detail && (
        <UpdateStatusDialog
          order={{ ...detail, items_count: items.length }}
          open={updateStatusOpen}
          onOpenChange={setUpdateStatusOpen}
        />
      )}
    </>
  );
}
