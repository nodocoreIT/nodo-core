import { useState } from "react";
import { ChevronDown, ChevronUp, Package } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nodocore/shared-components";
import { useMyOrders } from "@/features/customer-portal/hooks/use-my-orders";
import { cn } from "@/shared/lib/utils";
import type { OrderRow, OrderItemRow } from "@/shared/types/database";

type OrderItem = Pick<
  OrderItemRow,
  "id" | "product_name" | "variant_label" | "quantity" | "unit_price"
>;

const STATUS_LABELS: Record<OrderRow["status"], string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "En preparación",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<OrderRow["status"], string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-purple-100 text-purple-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(
    new Date(d),
  );
}

export function MyOrdersPage() {
  const { data: orders = [], isLoading } = useMyOrders();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-navy">Mis pedidos</h1>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && orders.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="font-medium text-foreground">No tenés pedidos todavía</p>
          <p className="text-sm text-muted-foreground mt-1">
            Cuando realices una compra, aparecerá acá.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {orders.map((order) => {
          const isOpen = expanded === order.id;
          const items = (order.order_items ?? []) as OrderItem[];

          return (
            <div
              key={order.id}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              {/* Order header row */}
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : order.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition text-left"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-mono text-sm font-bold text-foreground">
                      #{order.order_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "hidden sm:inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700",
                    )}
                  >
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-foreground">
                    {formatPrice(order.total)}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded items */}
              {isOpen && (
                <div className="border-t border-border p-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-medium">{item.product_name}</p>
                            {item.variant_label && (
                              <p className="text-xs text-muted-foreground">
                                {item.variant_label}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPrice(item.unit_price)}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatPrice(item.unit_price * item.quantity)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-3 flex justify-end">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between gap-8 font-bold">
                        <span>Total</span>
                        <span>{formatPrice(order.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
