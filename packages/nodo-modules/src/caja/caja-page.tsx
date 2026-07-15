"use client";
import { useMemo, useState } from "react";
import { Plus, ArrowUpRight, ArrowDownRight, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  FormSelect,
  Input,
  Label,
  PaginationControls,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@nodocore/shared-components";
import { cn } from "../lib/cn";
import { useCajaModule } from "./context";
import type { CashMovementRow, CashMovementType, CreateCashMovementInput } from "./types";

const DEFAULT_SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  commission: "Comisión",
  owner_payout: "Liquidación",
};

type SortKey = "date" | "concept" | "source" | "category" | "amount";
type SortDir = "asc" | "desc";

export function CajaPage() {
  const {
    movements,
    isLoading,
    isError,
    createMovement,
    updateMovement,
    deleteMovement,
    isSaving,
    isDeleting,
    formatMoney,
    formatDate,
    accountOptions,
    conceptOptions,
    sourceLabels = DEFAULT_SOURCE_LABELS,
    pageSize = 15,
    profitsHref,
    profitsLinkLabel = "Ganancias",
    emptyMessage = "Todavía no hay movimientos. Los cobros generan ingresos automáticamente.",
    createConcepto,
  } = useCajaModule();

  const [formOpen, setFormOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<CashMovementRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CashMovementRow | null>(null);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterDate, setFilterDate] = useState("");
  const [filterConcept, setFilterConcept] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterType, setFilterType] = useState<"" | "income" | "expense">("");

  const [formType, setFormType] = useState<CashMovementType>("expense");
  const [formAmount, setFormAmount] = useState("");
  const [formConcept, setFormConcept] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formAccount, setFormAccount] = useState("");
  const [formCurrency, setFormCurrency] = useState<"ARS" | "USD">("ARS");

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const movement of movements) {
      set.add(sourceLabels[movement.source] ?? movement.source);
    }
    return Array.from(set).sort();
  }, [movements, sourceLabels]);

  const accounts = useMemo(() => {
    const set = new Set<string>();
    for (const movement of movements) {
      if (movement.category) set.add(movement.category);
    }
    for (const option of accountOptions) {
      set.add(option.label);
    }
    return Array.from(set).sort();
  }, [movements, accountOptions]);

  const filtered = useMemo(() => {
    return movements.filter((movement) => {
      if (filterDate && movement.date !== filterDate) return false;
      if (
        filterConcept &&
        !movement.concept.toLowerCase().includes(filterConcept.toLowerCase())
      ) {
        return false;
      }
      const sourceLabel = sourceLabels[movement.source] ?? movement.source;
      if (filterSource && sourceLabel !== filterSource) return false;
      if (filterAccount && (movement.category ?? "") !== filterAccount) return false;
      if (filterType && movement.type !== filterType) return false;
      return true;
    });
  }, [
    movements,
    filterDate,
    filterConcept,
    filterSource,
    filterAccount,
    filterType,
    sourceLabels,
  ]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (sortKey === "concept") cmp = a.concept.localeCompare(b.concept);
      else if (sortKey === "source") {
        cmp = (sourceLabels[a.source] ?? a.source).localeCompare(
          sourceLabels[b.source] ?? b.source,
        );
      } else if (sortKey === "category") cmp = (a.category ?? "").localeCompare(b.category ?? "");
      else cmp = a.amount - b.amount;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [filtered, sortKey, sortDir, sourceLabels]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
    setPage(0);
  }

  const sortMark = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  function accountCurrency(accountValue: string): "ARS" | "USD" {
    return accountOptions.find((option) => option.value === accountValue)?.currency ?? formCurrency;
  }

  function openCreate() {
    setEditingMovement(null);
    setFormType("expense");
    setFormAmount("");
    setFormConcept("");
    setFormDate(new Date().toISOString().slice(0, 10));
    const defaultAccount = accountOptions[0]?.value ?? "";
    setFormAccount(defaultAccount);
    setFormCurrency(accountOptions[0]?.currency ?? "ARS");
    setFormOpen(true);
  }

  function openEdit(movement: CashMovementRow) {
    setEditingMovement(movement);
    setFormType(movement.type);
    setFormAmount(String(movement.amount));
    setFormConcept(movement.concept);
    setFormDate(movement.date);
    setFormAccount(movement.category ?? accountOptions[0]?.value ?? "");
    setFormCurrency(movement.currency);
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(formAmount);
    if (!formConcept.trim() || !amount || amount <= 0) return;

    const payload: CreateCashMovementInput = {
      type: formType,
      amount,
      currency: accountCurrency(formAccount),
      date: formDate,
      concept: formConcept.trim(),
      category: formAccount || null,
    };

    if (editingMovement) {
      await updateMovement({ id: editingMovement.id, ...payload });
    } else {
      await createMovement(payload);
    }
    setFormOpen(false);
    setEditingMovement(null);
  }

  async function handleConceptCreate(name: string) {
    if (!createConcepto) return;
    await createConcepto(name);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        {profitsHref ? (
          <p className="text-sm text-slate2">
            Los totales e historial detallado están en{" "}
            <a href={profitsHref} className="font-semibold text-brand hover:underline">
              {profitsLinkLabel}
            </a>
            .
          </p>
        ) : (
          <p className="text-sm text-slate2">Registro de ingresos y egresos de la agencia.</p>
        )}
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Nuevo movimiento
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={filterDate}
          onChange={(e) => {
            setFilterDate(e.target.value);
            setPage(0);
          }}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
          aria-label="Filtrar por fecha"
        />
        <input
          type="text"
          value={filterConcept}
          onChange={(e) => {
            setFilterConcept(e.target.value);
            setPage(0);
          }}
          placeholder="Concepto"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
        />
        <FormSelect
          value={filterSource}
          onChange={(value) => {
            setFilterSource(value);
            setPage(0);
          }}
          options={sources.map((source) => ({ value: source, label: source }))}
          allowEmpty
          emptyLabel="Todos los orígenes"
          aria-label="Filtrar por origen"
        />
        <FormSelect
          value={filterAccount}
          onChange={(value) => {
            setFilterAccount(value);
            setPage(0);
          }}
          options={accounts.map((account) => ({ value: account, label: account }))}
          allowEmpty
          emptyLabel="Todas las cuentas"
          aria-label="Filtrar por cuenta"
        />
        <FormSelect
          value={filterType}
          onChange={(value) => {
            setFilterType(value as "" | "income" | "expense");
            setPage(0);
          }}
          options={[
            { value: "income", label: "Solo ingresos" },
            { value: "expense", label: "Solo egresos" },
          ]}
          allowEmpty
          emptyLabel="Ingreso y egreso"
          aria-label="Filtrar por tipo"
        />
        {(filterDate || filterConcept || filterSource || filterAccount || filterType) && (
          <button
            type="button"
            className="text-xs text-slate2 underline-offset-2 hover:underline"
            onClick={() => {
              setFilterDate("");
              setFilterConcept("");
              setFilterSource("");
              setFilterAccount("");
              setFilterType("");
              setPage(0);
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {isLoading && (
        <div role="status" className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      )}

      {isError && (
        <p role="alert" className="text-sm text-destructive">
          Error al cargar la caja. Intentá de nuevo.
        </p>
      )}

      {!isLoading && !isError && movements.length === 0 && (
        <div className="rounded-md border border-dashed border-mist py-16 text-center text-sm text-slate2">
          {emptyMessage}
        </div>
      )}

      {!isLoading && !isError && sorted.length > 0 && (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button type="button" className="font-semibold" onClick={() => toggleSort("date")}>
                    Fecha{sortMark("date")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="font-semibold" onClick={() => toggleSort("concept")}>
                    Concepto{sortMark("concept")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="font-semibold" onClick={() => toggleSort("source")}>
                    Origen{sortMark("source")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="font-semibold" onClick={() => toggleSort("category")}>
                    Cuenta{sortMark("category")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button type="button" className="font-semibold" onClick={() => toggleSort("amount")}>
                    Monto{sortMark("amount")}
                  </button>
                </TableHead>
                <TableHead className="w-28 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{formatDate(movement.date)}</TableCell>
                  <TableCell className="font-medium">{movement.concept}</TableCell>
                  <TableCell className="text-slate2">
                    {sourceLabels[movement.source] ?? movement.source}
                  </TableCell>
                  <TableCell className="text-slate2">{movement.category ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-medium",
                        movement.type === "income" ? "text-green-700" : "text-destructive",
                      )}
                    >
                      {movement.type === "income" ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                      {movement.type === "income" ? "+" : "−"}
                      {formatMoney(movement.amount, movement.currency)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Editar ${movement.concept}`}
                        className="h-8 w-8 p-0 text-slate2 hover:text-navy"
                        onClick={() => openEdit(movement)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Eliminar ${movement.concept}`}
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                        disabled={isDeleting}
                        onClick={() => setDeleteTarget(movement)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
        total={sorted.length}
        pageSize={pageSize}
        itemLabel="movimientos"
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
      />

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingMovement(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMovement ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
            <DialogDescription>
              {editingMovement
                ? "Modificá los datos del movimiento manual."
                : "Registrá un ingreso o egreso manual de la caja."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <FormSelect
                  value={formType}
                  onChange={(value) => setFormType(value as CashMovementType)}
                  options={[
                    { value: "income", label: "Ingreso" },
                    { value: "expense", label: "Egreso" },
                  ]}
                />
              </div>
              <div className="space-y-1">
                <Label>Cuenta</Label>
                <FormSelect
                  value={formAccount}
                  onChange={(value) => {
                    setFormAccount(value);
                    const currency = accountOptions.find((option) => option.value === value)?.currency;
                    if (currency) setFormCurrency(currency);
                  }}
                  options={accountOptions}
                  allowEmpty
                  emptyLabel="Sin cuenta"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Monto</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder={accountCurrency(formAccount) === "USD" ? "US$ 0" : "$ 0"}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Concepto</Label>
              <Input
                list="caja-concepts"
                value={formConcept}
                onChange={(e) => setFormConcept(e.target.value)}
                onBlur={() => {
                  const trimmed = formConcept.trim();
                  if (trimmed && createConcepto && !conceptOptions.includes(trimmed)) {
                    void handleConceptCreate(trimmed);
                  }
                }}
                required
              />
              <datalist id="caja-concepts">
                {conceptOptions.map((concept) => (
                  <option key={concept} value={concept} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="mx-4 w-[calc(100%-2rem)] max-w-sm sm:mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.payment_id ? "¿Anular este cobro?" : "¿Eliminar este movimiento?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.payment_id ? (
                <>
                  Se va a anular el cobro &quot;{deleteTarget.concept}&quot; del{" "}
                  {formatDate(deleteTarget.date)}.
                </>
              ) : (
                <>
                  Se va a borrar &quot;{deleteTarget?.concept}&quot; del{" "}
                  {deleteTarget ? formatDate(deleteTarget.date) : ""}. Esta acción no se puede
                  deshacer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                if (!deleteTarget) return;
                void deleteMovement(deleteTarget).then(() => setDeleteTarget(null));
              }}
            >
              {deleteTarget?.payment_id ? "Anular cobro" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
