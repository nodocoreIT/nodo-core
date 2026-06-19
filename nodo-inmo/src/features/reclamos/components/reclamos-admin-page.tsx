import { useState } from "react";
import { useReclamos, ReclamoWithRelations } from "../hooks/use-reclamos";
import { useUpdateReclamo } from "../hooks/use-update-reclamo";
import { ReclamoStatusBadge } from "./reclamo-status-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button, FormSelect } from "@nodocore/shared-components";
import { cn } from "@/shared/lib/utils";

// ── Label maps ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  maintenance: "Mantenimiento",
  payment: "Pago",
  neighbor: "Vecinos",
  general: "General",
  other: "Otro",
};

const PRIORITY_CONFIG: Record<string, { label: string; classes: string }> = {
  alta: { label: "Alta", classes: "text-rose-600 font-semibold" },
  media: { label: "Media", classes: "text-amber-600 font-semibold" },
  baja: { label: "Baja", classes: "text-slate-500" },
};

// ── Filter tabs ───────────────────────────────────────────────────────────────

type FilterTab = "all" | "open" | "in_progress" | "resolved";

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Abiertos" },
  { value: "in_progress", label: "En curso" },
  { value: "resolved", label: "Resueltos" },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export function ReclamosAdminPage() {
  const { data: reclamos = [], isLoading } = useReclamos();
  const updateReclamo = useUpdateReclamo();

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selected, setSelected] = useState<ReclamoWithRelations | null>(null);

  // Detail panel form state
  const [formStatus, setFormStatus] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const openDetail = (reclamo: ReclamoWithRelations) => {
    setSelected(reclamo);
    setFormStatus(reclamo.status);
    setFormNotes(reclamo.admin_notes ?? "");
  };

  const closeDetail = () => {
    setSelected(null);
    setFormStatus("");
    setFormNotes("");
  };

  const handleSave = async () => {
    if (!selected) return;

    const isNowResolved = formStatus === "resolved" && selected.status !== "resolved";

    await updateReclamo.mutateAsync({
      id: selected.id,
      status: formStatus,
      admin_notes: formNotes || null,
      resolved_at: isNowResolved ? new Date().toISOString() : selected.resolved_at,
    } as Parameters<typeof updateReclamo.mutateAsync>[0]);

    closeDetail();
  };

  const filtered =
    activeTab === "all" ? reclamos : reclamos.filter((r) => r.status === activeTab);

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.value
                ? "border-brand text-brand"
                : "border-transparent text-slate2 hover:text-navy"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div
            role="status"
            aria-label="Cargando reclamos"
            className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent"
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-slate2 text-sm">
          No hay reclamos registrados
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate2">
                <th className="px-4 py-3">Inquilino</th>
                <th className="px-4 py-3">Propiedad</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Prioridad</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const priority = PRIORITY_CONFIG[r.priority] ?? { label: r.priority, classes: "" };
                return (
                  <tr
                    key={r.id}
                    onClick={() => openDetail(r)}
                    className="border-b border-border cursor-pointer transition-colors hover:bg-slate-50 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-navy">
                      {r.contact?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate2 max-w-[160px] truncate">
                      {r.property?.address ?? "—"}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{r.title}</td>
                    <td className="px-4 py-3 text-slate2">
                      {CATEGORY_LABELS[r.category] ?? r.category}
                    </td>
                    <td className={cn("px-4 py-3", priority.classes)}>{priority.label}</td>
                    <td className="px-4 py-3">
                      <ReclamoStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-slate2 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString("es-AR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{selected?.title}</DialogTitle>
            <DialogDescription>
              Reclamo de{" "}
              <span className="font-medium text-navy">{selected?.contact?.name ?? "—"}</span>
              {selected?.property?.address && (
                <> · {selected.property.address}</>
              )}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 py-1">
              {/* Meta row */}
              <div className="flex flex-wrap gap-3 text-xs text-slate2">
                <span>
                  Categoría:{" "}
                  <span className="font-semibold text-navy">
                    {CATEGORY_LABELS[selected.category] ?? selected.category}
                  </span>
                </span>
                <span>
                  Prioridad:{" "}
                  <span className={cn("font-semibold", PRIORITY_CONFIG[selected.priority]?.classes)}>
                    {PRIORITY_CONFIG[selected.priority]?.label ?? selected.priority}
                  </span>
                </span>
                {selected.contact?.phone && (
                  <span>
                    Tel:{" "}
                    <span className="font-semibold text-navy">{selected.contact.phone}</span>
                  </span>
                )}
              </div>

              {/* Description */}
              <div className="rounded-md bg-slate-50 border border-border p-3 text-sm text-slate-700 whitespace-pre-wrap">
                {selected.description}
              </div>

              {/* Status select */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate2 uppercase tracking-wide">
                  Estado
                </label>
                <FormSelect
                  value={formStatus}
                  onChange={setFormStatus}
                  options={[
                    { value: "open", label: "Abierto" },
                    { value: "in_progress", label: "En curso" },
                    { value: "resolved", label: "Resuelto" },
                    { value: "closed", label: "Cerrado" },
                  ]}
                />
              </div>

              {/* Admin notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate2 uppercase tracking-wide">
                  Notas internas
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={3}
                  placeholder="Observaciones para uso interno..."
                  className="w-full rounded border border-border p-2 text-sm bg-white resize-none focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={closeDetail}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={updateReclamo.isPending}
            >
              {updateReclamo.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
