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
} from "@nodocore/shared-components";
import { AlertTriangle, History, SlidersHorizontal } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useInventory } from "../hooks/use-inventory";
import type { InventoryWithProduct } from "../hooks/use-inventory";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { MovementsPanel } from "./movements-panel";

export function InventoryPage() {
  const [search, setSearch] = useState("");
  const [adjustItem, setAdjustItem] = useState<InventoryWithProduct | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [movProductId, setMovProductId] = useState<string | null>(null);
  const [movProductName, setMovProductName] = useState<string | undefined>();
  const [movOpen, setMovOpen] = useState(false);

  const { data: inventory = [], isLoading } = useInventory();

  const lowStockItems = inventory.filter(
    (item) =>
      item.low_stock_threshold !== null &&
      item.quantity <= item.low_stock_threshold,
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((item) =>
      item.product?.name.toLowerCase().includes(q),
    );
  }, [inventory, search]);

  function openAdjust(item: InventoryWithProduct) {
    setAdjustItem(item);
    setAdjustOpen(true);
  }

  function openMovements(item: InventoryWithProduct) {
    setMovProductId(item.product_id);
    setMovProductName(item.product?.name);
    setMovOpen(true);
  }

  function formatVariant(item: InventoryWithProduct): string | null {
    if (!item.variant?.attributes) return null;
    return Object.entries(item.variant.attributes)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Inventario</h1>
        <p className="text-slate2 text-sm mt-1">
          Controlá el stock de tus productos y registrá movimientos.
        </p>
      </div>

      {/* Low stock alert */}
      {!isLoading && lowStockItems.length > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-yellow-300 bg-yellow-50 p-4">
          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-800">
            <p className="font-semibold">
              {lowStockItems.length}{" "}
              {lowStockItems.length === 1 ? "producto con stock bajo" : "productos con stock bajo"}
            </p>
            <p className="text-yellow-700">
              {lowStockItems
                .map((i) => i.product?.name ?? "—")
                .slice(0, 3)
                .join(", ")}
              {lowStockItems.length > 3 && ` y ${lowStockItems.length - 3} más`}
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <Input
        placeholder="Buscar por nombre de producto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Table */}
      <div className="rounded-md border border-[var(--color-border)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead className="text-right">Disponible</TableHead>
              <TableHead className="text-right">Reservado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Stock mín.</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-sm text-[var(--color-muted-foreground)] py-8"
                >
                  Cargando inventario...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-sm text-[var(--color-muted-foreground)] py-8"
                >
                  No hay productos en inventario{search ? " que coincidan con la búsqueda" : ""}.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => {
                const isLowStock =
                  item.low_stock_threshold !== null &&
                  item.quantity <= item.low_stock_threshold;
                const variantLabel = formatVariant(item);

                return (
                  <TableRow
                    key={item.id}
                    className={cn(
                      isLowStock && "bg-yellow-50 hover:bg-yellow-100",
                    )}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {isLowStock && (
                          <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0" />
                        )}
                        {item.product?.name ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--color-muted-foreground)]">
                      {item.product?.sku ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-[var(--color-muted-foreground)]">
                      {variantLabel ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {item.available_quantity}
                    </TableCell>
                    <TableCell className="text-right text-[var(--color-muted-foreground)]">
                      {item.reserved_quantity}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right text-[var(--color-muted-foreground)]">
                      {item.low_stock_threshold ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAdjust(item)}
                          title="Ajustar stock"
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openMovements(item)}
                          title="Ver historial"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      {adjustItem && (
        <AdjustStockDialog
          item={adjustItem}
          open={adjustOpen}
          onOpenChange={(open) => {
            setAdjustOpen(open);
            if (!open) setAdjustItem(null);
          }}
        />
      )}

      <MovementsPanel
        productId={movProductId}
        productName={movProductName}
        open={movOpen}
        onOpenChange={(open) => {
          setMovOpen(open);
          if (!open) {
            setMovProductId(null);
            setMovProductName(undefined);
          }
        }}
      />
    </div>
  );
}
