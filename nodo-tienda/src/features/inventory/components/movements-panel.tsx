import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nodocore/shared-components";
import { cn } from "@/shared/lib/utils";
import { useInventoryMovements } from "../hooks/use-inventory";

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  in: "Entrada",
  out: "Salida",
  adjustment: "Ajuste",
  reservation: "Reserva",
  release: "Liberación",
};

const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  in: "bg-green-100 text-green-700",
  out: "bg-red-100 text-red-700",
  adjustment: "bg-blue-100 text-blue-700",
  reservation: "bg-yellow-100 text-yellow-700",
  release: "bg-gray-100 text-gray-700",
};

interface MovementsPanelProps {
  productId: string | null;
  productName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MovementsPanel({
  productId,
  productName,
  open,
  onOpenChange,
}: MovementsPanelProps) {
  const { data: movements = [], isLoading } = useInventoryMovements(productId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Historial de movimientos
            {productName && (
              <span className="ml-2 text-sm font-normal text-[var(--color-muted-foreground)]">
                — {productName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-[var(--color-border)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-[var(--color-muted-foreground)] py-8"
                  >
                    Cargando movimientos...
                  </TableCell>
                </TableRow>
              ) : movements.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-[var(--color-muted-foreground)] py-8"
                  >
                    No hay movimientos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((mov) => (
                  <TableRow key={mov.id}>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          MOVEMENT_TYPE_COLORS[mov.type] ?? "bg-gray-100 text-gray-700",
                        )}
                      >
                        {MOVEMENT_TYPE_LABELS[mov.type] ?? mov.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">{mov.quantity}</TableCell>
                    <TableCell className="text-sm text-[var(--color-muted-foreground)]">
                      {mov.reason ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-[var(--color-muted-foreground)]">
                      {new Date(mov.created_at).toLocaleString("es-AR")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
