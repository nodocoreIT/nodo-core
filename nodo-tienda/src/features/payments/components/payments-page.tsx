import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nodocore/shared-components";
import { cn } from "@/shared/lib/utils";
import { usePayments } from "../hooks/use-payments";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from "../lib/payment-utils";
import { formatPrice } from "@/features/orders/lib/order-utils";

export function PaymentsPage() {
  const { data: payments = [], isLoading } = usePayments();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const completedThisMonth = payments
    .filter(
      (p) =>
        p.status === "completed" && new Date(p.created_at) >= startOfMonth,
    )
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingTotal = payments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Pagos</h1>
        <p className="text-slate2 text-sm mt-1">
          Revisá los pagos recibidos, estados y referencias de transacciones.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs text-[var(--color-muted-foreground)]">Total cobrado este mes</p>
          <p className="text-2xl font-bold text-green-600">{formatPrice(completedThisMonth)}</p>
        </div>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs text-[var(--color-muted-foreground)]">Pendiente de cobro</p>
          <p className="text-2xl font-bold text-yellow-600">{formatPrice(pendingTotal)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-[var(--color-border)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Referencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-sm text-[var(--color-muted-foreground)] py-8"
                >
                  Cargando pagos...
                </TableCell>
              </TableRow>
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-sm text-[var(--color-muted-foreground)] py-8"
                >
                  No hay pagos registrados.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">
                    {payment.order
                      ? `#${payment.order.order_number}`
                      : <span className="text-[var(--color-muted-foreground)]">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPrice(payment.amount)}
                  </TableCell>
                  <TableCell>
                    {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        PAYMENT_STATUS_COLORS[payment.status] ?? "bg-gray-100 text-gray-700",
                      )}
                    >
                      {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-[var(--color-muted-foreground)]">
                    {new Date(payment.created_at).toLocaleDateString("es-AR")}
                  </TableCell>
                  <TableCell className="text-sm text-[var(--color-muted-foreground)]">
                    {payment.reference ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
