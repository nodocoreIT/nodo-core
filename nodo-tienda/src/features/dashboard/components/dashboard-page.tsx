import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  Package,
  ShoppingCart,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@nodocore/shared-components";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nodocore/shared-components";
import { useDashboardStats, useRecentOrders } from "@/features/dashboard/hooks/use-dashboard-stats";
import { StatCard } from "./stat-card";

// ── Formatters ────────────────────────────────────────────────────────────────

function formatPrice(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: string): string {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(
    new Date(d),
  );
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "Preparando",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-purple-100 text-purple-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

// ── Greeting ──────────────────────────────────────────────────────────────────

function greetingName(user: ReturnType<typeof useAuth>["user"]): string {
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  if (fullName) return fullName.split(" ")[0];
  const email = user?.email ?? "";
  return email.split("@")[0] || "Usuario";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentOrders = [], isLoading: ordersLoading } = useRecentOrders();

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-navy">
          Hola, {greetingName(user)}
        </h1>
        <p className="mt-1 text-sm text-slate2">
          Bienvenido a tu panel de gestión de tienda.
        </p>
      </div>

      {/* KPI Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            title="Pedidos hoy"
            value={stats?.ordersToday ?? 0}
            icon={ShoppingCart}
            description="pedidos creados hoy"
          />
          <StatCard
            title="Pedidos pendientes"
            value={stats?.ordersPending ?? 0}
            icon={Clock}
            description="esperando confirmación"
            highlight={(stats?.ordersPending ?? 0) > 0}
          />
          <StatCard
            title="Facturación del mes"
            value={formatPrice(stats?.revenueThisMonth ?? 0)}
            icon={TrendingUp}
            description="pedidos confirmados este mes"
          />
          <StatCard
            title="Nuevos clientes"
            value={stats?.newCustomersThisMonth ?? 0}
            icon={UserPlus}
            description="este mes"
          />
          <StatCard
            title="Stock bajo"
            value={stats?.lowStockItems ?? 0}
            icon={AlertTriangle}
            description="productos con stock crítico"
            highlight={(stats?.lowStockItems ?? 0) > 0}
          />
          <StatCard
            title="Productos activos"
            value={stats?.totalProducts ?? 0}
            icon={Package}
            description="en catálogo"
          />
        </div>
      )}

      {/* Recent Orders */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Últimos pedidos</h2>
          <Link
            to="/admin/orders"
            className="text-sm text-primary hover:underline"
          >
            Ver todos
          </Link>
        </div>

        {ordersLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Todavía no hay pedidos registrados.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.map((order) => {
                const customer = order.customer as
                  | { id: string; first_name: string; last_name: string }
                  | null;
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {order.order_number}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer
                        ? `${customer.first_name} ${customer.last_name}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(order.created_at)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(order.total)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[order.status] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
