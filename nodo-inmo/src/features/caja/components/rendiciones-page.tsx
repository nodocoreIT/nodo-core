import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Download, FileText, HandCoins, Loader2, Share2 } from "lucide-react";
import { Button } from "@nodocore/shared-components";
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
import { useOwnerSettlements } from "@/features/caja/hooks/use-owner-settlements";
import { useSettleOwner } from "@/features/caja/hooks/use-settle-owner";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import { usePdfLogoUrl } from "@/features/agency-profile/hooks/use-pdf-logo-url";
import { groupPendingByProperty } from "@/features/caja/lib/caja-math";
import { buildPendingStatementData } from "@/features/caja/lib/pending-settlement-pdf";
import { usePendingExpenses } from "@/features/caja/hooks/use-pending-expenses";
import { buildStatementData, type SealedBreakdown, type StatementData } from "@/features/caja/lib/settlement-statement-data";
import { handleDownload, handleShare } from "@/features/caja/lib/settlement-pdf-actions";
import { SettlementPdfViewer } from "./settlement-pdf-viewer";
import { formatMoney } from "@/features/contracts/lib/contract-labels";

export function RendicionesPage() {
  const { data, isLoading, isError } = useOwnerSettlements();
  const settleOwner = useSettleOwner();
  const { data: agency } = useOrgProfile();
  const { data: logoUrl } = usePdfLogoUrl();
  const { data: expenses, isLoading: expensesLoading } = usePendingExpenses();
  const [previewLoadingKey, setPreviewLoadingKey] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewStatement, setPreviewStatement] = useState<StatementData | null>(null);
  const [finalizeLoading, setFinalizeLoading] = useState<string | null>(null);
  const [finalizedStatement, setFinalizedStatement] = useState<StatementData | null>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  const allSettlements = data ?? [];
  const pendingGroups = groupPendingByProperty(allSettlements);

  async function openPreview(group: (typeof pendingGroups)[number]) {
    const key = `${group.owner_id}:${group.property_id}:${group.currency}`;
    setPreviewLoadingKey(key);
    try {
      const statement = await buildPendingStatementData(
        group,
        allSettlements,
        agency ?? null,
        logoUrl ?? null,
      );
      setPreviewStatement(statement);
      setPreviewOpen(true);
    } finally {
      setPreviewLoadingKey(null);
    }
  }

  async function handleFinalize(group: (typeof pendingGroups)[number]) {
    const key = `${group.owner_id}:${group.property_id}:${group.currency}`;
    setFinalizeLoading(key);
    try {
      const sealedJson = await settleOwner.mutateAsync({
        owner_id: group.owner_id,
        owner_name: group.owner_name,
        property_id: group.property_id,
        settlement_ids: group.settlement_ids,
        total: group.total,
        currency: group.currency,
      });
      if (sealedJson) {
        const sealed = sealedJson as unknown as SealedBreakdown;
        const statement = buildStatementData({
          breakdown: { ...sealed, currency: group.currency },
          agency: agency ?? null,
          logoUrl: logoUrl ?? null,
          ownerName: group.owner_name,
          settledDate: new Date().toISOString().slice(0, 10),
        });
        setFinalizedStatement(statement);
        setFinalizeOpen(true);
      }
    } finally {
      setFinalizeLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HandCoins className="h-6 w-6 text-brand" />
          <h1 className="font-display text-xl font-bold text-navy">
            Rendiciones pendientes a dueños
          </h1>
        </div>
        <Link
          to="/admin/dashboard"
          className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-card px-4 py-1.5 text-xs font-semibold text-slate2 hover:bg-mist"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al inicio
        </Link>
      </div>

      {(isLoading || expensesLoading) && (
        <div
          role="status"
          aria-label="Cargando rendiciones"
          className="flex items-center justify-center py-16"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Error al cargar las rendiciones. Intentá de nuevo.
        </div>
      )}

      {!isLoading && !expensesLoading && !isError && pendingGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-mist py-16 text-center">
          <p className="text-sm font-medium text-slate2">
            No hay rendiciones pendientes
          </p>
          <p className="text-xs text-slate2">
            Cuando cobres alquileres, acá vas a ver lo que falta entregar a cada
            propietario.
          </p>
        </div>
      )}

      {!isLoading && !expensesLoading && !isError && pendingGroups.length > 0 && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propietario</TableHead>
                <TableHead>Propiedad</TableHead>
                <TableHead>Cant. pagos</TableHead>
                <TableHead className="text-right">Cobrado (bruto)</TableHead>
                <TableHead className="text-right">Adm. inmo.</TableHead>
                <TableHead className="text-right">Gastos</TableHead>
                <TableHead className="text-right">Total a rendir</TableHead>
                <TableHead className="w-44 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingGroups.map((group) => {
                const rowKey = `${group.owner_id}:${group.property_id}:${group.currency}`;
                const isPreviewLoading = previewLoadingKey === rowKey;

                // Sumar los gastos que corresponden a esta propiedad y moneda
                const propExpenses = (expenses ?? []).filter(
                  (e) =>
                    e.property_id === group.property_id &&
                    e.currency === group.currency
                );
                const expensesTotal = propExpenses.reduce((acc, curr) => acc + curr.amount, 0);
                const finalNet = group.total - expensesTotal;
                const commissionRate =
                  group.gross_collected > 0
                    ? Math.round((group.commission / group.gross_collected) * 10000) / 100
                    : 0;

                return (
                  <TableRow key={rowKey}>
                    <TableCell className="font-semibold text-navy">
                      {group.owner_name}
                    </TableCell>
                    <TableCell className="text-sm text-slate2">
                      {group.property_address}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-pill bg-mist px-2.5 py-0.5 text-xs font-semibold text-slate2">
                        {group.settlement_ids.length}{" "}
                        {group.settlement_ids.length === 1 ? "cobro" : "cobros"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(group.gross_collected, group.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate2">
                      {group.commission > 0 ? (
                        <span title={`${commissionRate}%`}>
                          − {formatMoney(group.commission, group.currency)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {expensesTotal > 0 ? (
                        <span className="text-destructive">− {formatMoney(expensesTotal, group.currency)}</span>
                      ) : (
                        <span className="text-slate2">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-navy">
                      {formatMoney(finalNet, group.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Ver liquidación de ${group.owner_name}`}
                          title="Ver liquidación"
                          disabled={isPreviewLoading}
                          onClick={() => void openPreview(group)}
                          className="text-slate2 hover:text-navy"
                        >
                          {isPreviewLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Rendir a ${group.owner_name}`}
                          disabled={finalizeLoading === rowKey || settleOwner.isPending}
                          className="gap-1 text-green-700 hover:bg-green-50 hover:text-green-800"
                          onClick={() => void handleFinalize(group)}
                        >
                          {finalizeLoading === rowKey ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Rendir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex h-[85vh] max-w-4xl flex-col gap-0 p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>
              {previewStatement
                ? `Liquidación — ${previewStatement.ownerName}`
                : "Vista previa PDF"}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 p-4">
            {previewStatement ? (
              <SettlementPdfViewer data={previewStatement} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <DialogContent className="flex h-[85vh] max-w-4xl flex-col gap-0 p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>
              {finalizedStatement
                ? `Liquidación finalizada — ${finalizedStatement.ownerName}`
                : "Liquidación finalizada"}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 p-4">
            {finalizedStatement ? (
              <div className="flex h-full flex-col gap-3">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void handleDownload(finalizedStatement)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descargar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void handleShare(finalizedStatement)}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Compartir
                  </Button>
                </div>
                <SettlementPdfViewer data={finalizedStatement} />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
