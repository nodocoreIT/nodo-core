import { useMemo, useState } from "react";
import { Plus, ArrowUpRight, ArrowDownRight, Pencil, Trash2 } from "lucide-react";
import {
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@nodocore/shared-components";
import { cn } from "../lib/cn";
import { useCajaModule } from "./context";
import type { CashMovementRow, CashMovementType, CreateCashMovementInput } from "./types";

const PAGE_SIZE = 15;

export function CajaPage() {
  const {
    movements,
    isLoading,
    isError,
    createMovement,
    updateMovement,
    deleteMovement,
    isSaving,
    formatMoney,
    formatDate,
    accountOptions,
    conceptOptions,
    profitsHref,
  } = useCajaModule();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CashMovementRow | null>(null);
  const [page, setPage] = useState(0);
  const [filterType, setFilterType] = useState<"" | CashMovementType>("");
  const [filterConcept, setFilterConcept] = useState("");

  const [formType, setFormType] = useState<CashMovementType>("expense");
  const [formAmount, setFormAmount] = useState("");
  const [formConcept, setFormConcept] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formAccount, setFormAccount] = useState("");
  const [formCurrency, setFormCurrency] = useState<"ARS" | "USD">("ARS");

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      if (filterType && m.type !== filterType) return false;
      if (filterConcept && !m.concept.toLowerCase().includes(filterConcept.toLowerCase())) return false;
      return true;
    });
  }, [movements, filterType, filterConcept]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const balance = useMemo(() => {
    return movements.reduce((acc, m) => {
      const sign = m.type === "income" ? 1 : -1;
      return acc + sign * m.amount;
    }, 0);
  }, [movements]);

  function openCreate() {
    setEditing(null);
    setFormType("expense");
    setFormAmount("");
    setFormConcept("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormAccount(accountOptions[0]?.value ?? "");
    setFormCurrency("ARS");
    setFormOpen(true);
  }

  function openEdit(row: CashMovementRow) {
    setEditing(row);
    setFormType(row.type);
    setFormAmount(String(row.amount));
    setFormConcept(row.concept);
    setFormDate(row.date);
    setFormAccount(row.category ?? accountOptions[0]?.value ?? "");
    setFormCurrency(row.currency);
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(formAmount);
    if (!formConcept.trim() || !amount || amount <= 0) return;

    const payload: CreateCashMovementInput = {
      type: formType,
      amount,
      currency: formCurrency,
      date: formDate,
      concept: formConcept.trim(),
      category: formAccount || null,
    };

    if (editing) {
      await updateMovement({ id: editing.id, ...payload });
    } else {
      await createMovement(payload);
    }
    setFormOpen(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-slate2">
            Balance estimado:{" "}
            <span className="font-semibold text-navy">{formatMoney(balance, "ARS")}</span>
          </p>
          {profitsHref ? (
            <p className="text-xs text-slate2">
              Los totales detallados pueden verse en{" "}
              <a href={profitsHref} className="font-semibold text-brand hover:underline">
                reportes
              </a>
              .
            </p>
          ) : null}
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0 bg-brand hover:bg-brand-600 text-white">
          <Plus className="h-4 w-4" />
          Nuevo movimiento
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FormSelect
          value={filterType}
          onChange={(v) => {
            setFilterType(v as "" | CashMovementType);
            setPage(0);
          }}
          allowEmpty
          emptyLabel="Todos los tipos"
          options={[
            { value: "income", label: "Ingresos" },
            { value: "expense", label: "Egresos" },
          ]}
          triggerClassName="h-9 text-sm w-40"
        />
        <Input
          value={filterConcept}
          onChange={(e) => {
            setFilterConcept(e.target.value);
            setPage(0);
          }}
          placeholder="Filtrar concepto"
          className="h-9 w-48"
        />
      </div>

      <div className="rounded-xl border border-mist bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-slate2">
                  Cargando movimientos…
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-red-600">
                  No se pudieron cargar los movimientos.
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-slate2">
                  Sin movimientos registrados.
                </TableCell>
              </TableRow>
            ) : (
              paged.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm">{formatDate(m.date)}</TableCell>
                  <TableCell className="text-sm font-medium text-navy">{m.concept}</TableCell>
                  <TableCell className="text-sm text-slate2">{m.category ?? "—"}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        m.type === "income"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700",
                      )}
                    >
                      {m.type === "income" ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {m.type === "income" ? "Ingreso" : "Egreso"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold">
                    {formatMoney(m.amount, m.currency)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(m)}
                        className="rounded p-1.5 text-slate2 hover:text-brand hover:bg-brand/10"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteMovement(m.id)}
                        className="rounded p-1.5 text-slate2 hover:text-red-600 hover:bg-red-50"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > PAGE_SIZE ? (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          itemLabel="movimientos"
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        />
      ) : null}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <FormSelect
                  value={formType}
                  onChange={(v) => setFormType(v as CashMovementType)}
                  options={[
                    { value: "income", label: "Ingreso" },
                    { value: "expense", label: "Egreso" },
                  ]}
                />
              </div>
              <div className="space-y-1">
                <Label>Moneda</Label>
                <FormSelect
                  value={formCurrency}
                  onChange={(v) => setFormCurrency(v as "ARS" | "USD")}
                  options={[
                    { value: "ARS", label: "ARS" },
                    { value: "USD", label: "USD" },
                  ]}
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
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Concepto</Label>
              <Input
                list="caja-concepts"
                value={formConcept}
                onChange={(e) => setFormConcept(e.target.value)}
                required
              />
              <datalist id="caja-concepts">
                {conceptOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Cuenta</Label>
                <FormSelect
                  value={formAccount}
                  onChange={setFormAccount}
                  options={accountOptions}
                  allowEmpty
                  emptyLabel="Sin cuenta"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-brand hover:bg-brand-600 text-white">
                {isSaving ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
