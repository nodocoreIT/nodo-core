import { useState, useMemo, useEffect } from "react";
import { Plus, Pencil, Archive, FileText, ArrowUpDown, ArrowUp, ArrowDown, MessageCircle } from "lucide-react";
import { PaginationControls } from "@nodocore/shared-components";
import { Button } from "@nodocore/shared-components";
import { useContracts } from "@/features/contracts/hooks/use-contracts";
import type { ContractWithRelations } from "@/features/contracts/hooks/use-contracts";
import { useArchiveContract } from "@/features/contracts/hooks/use-archive-contract";
import { useUpdateContract } from "@/features/contracts/hooks/use-update-contract";
import { ContractFormDialog } from "./contract-form-dialog";
import { useSearchStore } from "@nodocore/shared-components";
import { matchesQuery } from "@/shared/search/matches-query";
import { CreateContractDialog } from "./create-contract-dialog";
import { ContractPdfViewer } from "./contract-pdf-viewer";
import { GeneratePaymentsDialog } from "./generate-payments-dialog";
import { ContractStatusBadge } from "./contract-status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nodocore/shared-components";
import {
  ADJUSTMENT_INDEX_LABELS,
  formatMoney,
  formatDate,
} from "@/features/contracts/lib/contract-labels";
import { PAGE_SIZE } from "@/shared/lib/constants";

export function ContractsList() {
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading, isError } = useContracts({ includeArchived: showArchived });
  const query = useSearchStore((s) => s.query);
  const [createOpen, setCreateOpen] = useState(false);
  const [editContract, setEditContract] =
    useState<ContractWithRelations | null>(null);
  const [viewContract, setViewContract] =
    useState<ContractWithRelations | null>(null);
  const archiveContract = useArchiveContract();
  const updateContract = useUpdateContract();
  const [generateForContract, setGenerateForContract] = useState<{
    id: string;
    start_date: string;
    end_date: string;
    rent_amount: number;
    currency: string;
    status: string;
    expenses_amount: number;
  } | null>(null);
  const [page, setPage] = useState(0);
  const [sortConfig, setSortConfig] = useState<{
    key: "tenant" | "property" | "start_date" | "end_date" | null;
    direction: "asc" | "desc";
  }>({ key: null, direction: "asc" });

  const filtered = (data ?? []).filter((c) =>
    matchesQuery(
      [c.property?.address, c.tenant?.name, c.status, c.adjustment_index],
      query,
    ),
  );
  const noResults = !!data && data.length > 0 && filtered.length === 0;

  const sortedAndFiltered = useMemo(() => {
    const list = [...filtered];
    if (!sortConfig.key) return list;

    list.sort((a, b) => {
      let valA = "";
      let valB = "";

      if (sortConfig.key === "tenant") {
        valA = a.tenant?.name ?? "";
        valB = b.tenant?.name ?? "";
      } else if (sortConfig.key === "property") {
        valA = a.property?.address ?? "";
        valB = b.property?.address ?? "";
      } else if (sortConfig.key === "start_date") {
        valA = a.start_date ?? "";
        valB = b.start_date ?? "";
      } else if (sortConfig.key === "end_date") {
        valA = a.end_date ?? "";
        valB = b.end_date ?? "";
      }

      if (sortConfig.direction === "asc") {
        return valA.localeCompare(valB, undefined, { sensitivity: "base" });
      } else {
        return valB.localeCompare(valA, undefined, { sensitivity: "base" });
      }
    });

    return list;
  }, [filtered, sortConfig]);

  const totalPages = Math.ceil(sortedAndFiltered.length / PAGE_SIZE);
  const pagedRows = useMemo(
    () => sortedAndFiltered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sortedAndFiltered, page],
  );

  useEffect(() => {
    setPage(0);
  }, [query]);

  return (
    <div className="flex flex-col gap-6">
      {/* Action row */}
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => {
              setShowArchived(e.target.checked);
              setPage(0);
            }}
            className="accent-brand"
          />
          Ver contratos archivados
        </label>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo contrato
        </Button>
      </div>

      {isLoading && (
        <div
          role="status"
          aria-label="Cargando contratos"
          className="flex items-center justify-center py-16"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="sr-only">Cargando…</span>
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Error al cargar los contratos. Intentá de nuevo.
        </div>
      )}

      {!isLoading && !isError && data?.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-mist py-16 text-center">
          <p className="text-sm font-medium text-slate2">
            Todavía no cargaste contratos
          </p>
          <p className="text-xs text-slate2-300">
            Hacé clic en "Nuevo contrato" para empezar.
          </p>
        </div>
      )}

      {!isLoading && !isError && noResults && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-mist py-12 text-center">
          <p className="text-sm font-medium text-slate2">
            Sin resultados para "{query}"
          </p>
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => {
                    setSortConfig((prev) => {
                      if (prev.key === "tenant") {
                        if (prev.direction === "asc") {
                          return { key: "tenant", direction: "desc" };
                        } else {
                          return { key: null, direction: "asc" };
                        }
                      }
                      return { key: "tenant", direction: "asc" };
                    });
                  }}
                >
                  <div className="flex items-center gap-1">
                    Inquilino
                    {sortConfig.key === "tenant" && sortConfig.direction === "asc" ? (
                      <ArrowUp className="h-3.5 w-3.5 text-brand" />
                    ) : sortConfig.key === "tenant" && sortConfig.direction === "desc" ? (
                      <ArrowDown className="h-3.5 w-3.5 text-brand" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => {
                    setSortConfig((prev) => {
                      if (prev.key === "property") {
                        if (prev.direction === "asc") {
                          return { key: "property", direction: "desc" };
                        } else {
                          return { key: null, direction: "asc" };
                        }
                      }
                      return { key: "property", direction: "asc" };
                    });
                  }}
                >
                  <div className="flex items-center gap-1">
                    Propiedad
                    {sortConfig.key === "property" && sortConfig.direction === "asc" ? (
                      <ArrowUp className="h-3.5 w-3.5 text-brand" />
                    ) : sortConfig.key === "property" && sortConfig.direction === "desc" ? (
                      <ArrowDown className="h-3.5 w-3.5 text-brand" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => {
                    setSortConfig((prev) => {
                      if (prev.key === "start_date") {
                        if (prev.direction === "asc") {
                          return { key: "start_date", direction: "desc" };
                        } else {
                          return { key: null, direction: "asc" };
                        }
                      }
                      return { key: "start_date", direction: "asc" };
                    });
                  }}
                >
                  <div className="flex items-center gap-1">
                    Inicio
                    {sortConfig.key === "start_date" && sortConfig.direction === "asc" ? (
                      <ArrowUp className="h-3.5 w-3.5 text-brand" />
                    ) : sortConfig.key === "start_date" && sortConfig.direction === "desc" ? (
                      <ArrowDown className="h-3.5 w-3.5 text-brand" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => {
                    setSortConfig((prev) => {
                      if (prev.key === "end_date") {
                        if (prev.direction === "asc") {
                          return { key: "end_date", direction: "desc" };
                        } else {
                          return { key: null, direction: "asc" };
                        }
                      }
                      return { key: "end_date", direction: "asc" };
                    });
                  }}
                >
                  <div className="flex items-center gap-1">
                    Fin
                    {sortConfig.key === "end_date" && sortConfig.direction === "asc" ? (
                      <ArrowUp className="h-3.5 w-3.5 text-brand" />
                    ) : sortConfig.key === "end_date" && sortConfig.direction === "desc" ? (
                      <ArrowDown className="h-3.5 w-3.5 text-brand" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead>Alquiler</TableHead>
                <TableHead>Ajuste</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-32 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell>{contract.tenant?.name ?? "—"}</TableCell>
                  <TableCell className="font-medium">
                    {contract.property?.address ?? "Sin definir"}
                  </TableCell>
                  <TableCell>{formatDate(contract.start_date)}</TableCell>
                  <TableCell>{formatDate(contract.end_date)}</TableCell>
                  <TableCell>
                    {formatMoney(contract.rent_amount, contract.currency)}
                  </TableCell>
                  <TableCell>
                    {ADJUSTMENT_INDEX_LABELS[contract.adjustment_index] ??
                      contract.adjustment_index}{" "}
                    / {contract.adjustment_period_months}m
                  </TableCell>
                  <TableCell>
                    <ContractStatusBadge
                      status={contract.status}
                      archivedAt={contract.archived_at}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!contract.archived_at && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Avisar aumento por WhatsApp"
                          title="Funcionalidad en desarrollo"
                          disabled
                          className="text-slate-400 cursor-not-allowed"
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span className="sr-only">Enviar aviso WhatsApp</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Ver PDF"
                        title="Ver PDF"
                        onClick={() => setViewContract(contract)}
                      >
                        <FileText className="h-4 w-4" />
                        <span className="sr-only">Ver PDF</span>
                      </Button>
                      {!contract.archived_at && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Editar"
                            onClick={() => setEditContract(contract)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <ArchiveAction
                            onConfirm={() =>
                              archiveContract.mutateAsync(contract.id)
                            }
                          />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginationControls
        page={page}
        totalPages={totalPages}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        itemLabel="contratos"
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      <CreateContractDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => setCreateOpen(false)}
      />

      {editContract && (
        <ContractFormDialog
          open={!!editContract}
          onOpenChange={(open) => {
            if (!open) setEditContract(null);
          }}
          contract={editContract}
          onSuccess={() => setEditContract(null)}
          onSubmit={async (payload) => {
            await updateContract.mutateAsync({ id: editContract.id, ...payload });
            setGenerateForContract({
              id: editContract.id,
              start_date: payload.start_date,
              end_date: payload.end_date,
              rent_amount: payload.rent_amount,
              currency: payload.currency,
              status: payload.status,
              expenses_amount: payload.expenses_amount ?? 0,
            });
          }}
          isPending={updateContract.isPending}
        />
      )}

      <GeneratePaymentsDialog
        open={!!generateForContract}
        contract={generateForContract}
        onClose={() => setGenerateForContract(null)}
      />

      {/* PDF viewer dialog */}
      <Dialog
        open={!!viewContract}
        onOpenChange={(open) => {
          if (!open) setViewContract(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Contrato</DialogTitle>
            <DialogDescription>
              {viewContract?.tenant?.name ?? "—"} ·{" "}
              {viewContract?.property?.address ?? "—"} ·{" "}
              <ContractStatusBadge
                status={viewContract?.status ?? ""}
                archivedAt={viewContract?.archived_at}
              />
            </DialogDescription>
          </DialogHeader>
          {viewContract && <ContractPdfViewer contract={viewContract} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Archive action ────────────────────────────────────────────────────────────

function ArchiveAction({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Archivar contrato">
          <Archive className="h-4 w-4 text-slate2" />
          <span className="sr-only">Archivar contrato</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Archivar este contrato?</AlertDialogTitle>
          <AlertDialogDescription>
            El contrato dejará de aparecer en el dashboard y en cobros pendientes.
            Las cuotas ya cobradas se conservan en el historial. Las cuotas
            pendientes se cancelan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Archivar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
