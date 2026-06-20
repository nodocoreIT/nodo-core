import { useState, useMemo } from "react";
import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  PaginationControls,
} from "@nodocore/shared-components";
import { Eye } from "lucide-react";
import { useOrders } from "../hooks/use-orders";
import type { OrderWithCustomer, OrderStatus } from "../hooks/use-orders";
import { OrderStatusBadge } from "./order-status-badge";
import { OrderDetailPanel } from "./order-detail-panel";
import { formatPrice, ORDER_STATUS_LABELS } from "../lib/order-utils";

const PAGE_SIZE = 20;

type TabKey = "all" | OrderStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "pending", label: ORDER_STATUS_LABELS.pending },
  { key: "confirmed", label: ORDER_STATUS_LABELS.confirmed },
  { key: "preparing", label: ORDER_STATUS_LABELS.preparing },
  { key: "shipped", label: ORDER_STATUS_LABELS.shipped },
  { key: "delivered", label: ORDER_STATUS_LABELS.delivered },
  { key: "cancelled", label: ORDER_STATUS_LABELS.cancelled },
];

export function OrdersPage() {
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithCustomer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: orders = [], isLoading } = useOrders(
    tab !== "all" ? { status: tab } : undefined,
  );

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const todayCount = orders.filter(
    (o) => new Date(o.created_at) >= startOfToday,
  ).length;
  const deliveredThisMonth = orders.filter(
    (o) => o.status === "delivered" && new Date(o.created_at) >= startOfMonth,
  ).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const customerName = o.customer
        ? `${o.customer.first_name} ${o.customer.last_name}`.toLowerCase()
        : "";
      return (
        o.order_number.toLowerCase().includes(q) || customerName.includes(q)
      );
    });
  }, [orders, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleTabChange(key: TabKey) {
    setTab(key);
    setPage(0);
    setSearch("");
  }

  function handleSearch(value: string) {
    setSearch(value);
    setPage(0);
  }

  function openDetail(order: OrderWithCustomer) {
    setSelectedOrder(order);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Pedidos</h1>
        <p className="text-slate2 text-sm mt-1">
          Gestioná los pedidos de tu tienda, estados y entregas.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs text-[var(--color-muted-foreground)]">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
        </div>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs text-[var(--color-muted-foreground)]">Hoy</p>
          <p className="text-2xl font-bold">{todayCount}</p>
        </div>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs text-[var(--color-muted-foreground)]">Entregados este mes</p>
          <p className="text-2xl font-bold text-green-600">{deliveredThisMonth}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => handleTabChange(t.key)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <Input
        placeholder="Buscar por N° de pedido o cliente..."
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Table */}
      <div className="rounded-md border border-[var(--color-border)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Artículos</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-[var(--color-muted-foreground)] py-8">
                  Cargando pedidos...
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-[var(--color-muted-foreground)] py-8">
                  No hay pedidos{search ? " que coincidan con la búsqueda" : ""}.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer hover:bg-[var(--color-muted)]"
                  onClick={() => openDetail(order)}
                >
                  <TableCell className="font-medium">#{order.order_number}</TableCell>
                  <TableCell>
                    {order.customer
                      ? `${order.customer.first_name} ${order.customer.last_name}`
                      : <span className="text-[var(--color-muted-foreground)]">Sin cliente</span>}
                  </TableCell>
                  <TableCell className="text-sm text-[var(--color-muted-foreground)]">
                    {new Date(order.created_at).toLocaleDateString("es-AR")}
                  </TableCell>
                  <TableCell className="text-right">{order.items_count}</TableCell>
                  <TableCell className="text-right font-medium">{formatPrice(order.total)}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(order);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        page={page}
        totalPages={totalPages}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        itemLabel="pedidos"
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      <OrderDetailPanel
        order={selectedOrder}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedOrder(null);
        }}
      />
    </div>
  );
}
