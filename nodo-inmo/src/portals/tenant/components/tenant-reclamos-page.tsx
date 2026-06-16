import { useState } from "react";
import { Plus } from "lucide-react";
import { useMyReclamos } from "../hooks/use-my-reclamos";
import { useMyContact } from "../hooks/use-my-contact";
import { useCreateReclamo } from "../hooks/use-create-reclamo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/utils";

// ── Status badge ──────────────────────────────────────────────────────────────

function ReclamoStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    open: { label: "Abierto", className: "bg-blue-100 text-blue-700" },
    in_progress: { label: "En proceso", className: "bg-yellow-100 text-yellow-700" },
    resolved: { label: "Resuelto", className: "bg-green-100 text-green-700" },
    closed: { label: "Cerrado", className: "bg-gray-100 text-gray-600" },
  };
  const config = map[status] ?? { label: status, className: "bg-mist text-slate2" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

// ── Priority badge ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { label: string; className: string }> = {
    alta: { label: "Alta", className: "bg-red-50 text-red-600 border border-red-200" },
    media: { label: "Media", className: "bg-yellow-50 text-yellow-600 border border-yellow-200" },
    baja: { label: "Baja", className: "bg-gray-50 text-gray-500 border border-gray-200" },
  };
  const config = map[priority] ?? {
    label: priority,
    className: "bg-mist text-slate2 border border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

// ── Category label ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  maintenance: "Mantenimiento",
  payment: "Pago",
  neighbor: "Vecinos",
  general: "General",
  other: "Otro",
};

// ── New reclamo form ──────────────────────────────────────────────────────────

interface NewReclamoFormProps {
  contactId: string;
  orgId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function NewReclamoForm({ contactId, orgId, onSuccess, onCancel }: NewReclamoFormProps) {
  const { mutate, isPending, error } = useCreateReclamo();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("media");
  const [description, setDescription] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !title.trim()) return;

    mutate(
      {
        title: title.trim(),
        category,
        priority,
        description: description.trim(),
        contact_id: contactId,
        org_id: orgId,
      },
      { onSuccess },
    );
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-paper px-3 py-2 text-sm text-foreground placeholder:text-slate2 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors";

  const labelClass = "block mb-1 text-xs font-semibold uppercase tracking-wide text-slate2";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          Error al enviar el reclamo. Intentá de nuevo.
        </p>
      )}

      <div>
        <label className={labelClass}>Título</label>
        <input
          className={inputClass}
          type="text"
          placeholder="Descripción breve del problema"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={120}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Categoría</label>
          <select
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="maintenance">Mantenimiento</option>
            <option value="payment">Pago</option>
            <option value="neighbor">Vecinos</option>
            <option value="general">General</option>
            <option value="other">Otro</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Prioridad</label>
          <select
            className={inputClass}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Descripción</label>
        <textarea
          className={cn(inputClass, "resize-none")}
          rows={4}
          placeholder="Describí el problema con el mayor detalle posible"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>

      <DialogFooter>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium text-slate2 transition-colors hover:bg-mist"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending || !title.trim() || !description.trim()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Enviando…" : "Enviar reclamo"}
        </button>
      </DialogFooter>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function TenantReclamosPage() {
  const { data: reclamos = [], isLoading, error } = useMyReclamos();
  const { data: contact } = useMyContact();
  const [dialogOpen, setDialogOpen] = useState(false);

  function formatDate(value: string): string {
    return new Date(value).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy">Mis Reclamos</h2>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          Nuevo Reclamo
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-mist" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-red-600">
          Error al cargar los reclamos. Intentá de nuevo más tarde.
        </div>
      ) : reclamos.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-slate2">No tenés reclamos registrados.</p>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="mt-3 text-sm font-medium text-brand hover:underline"
          >
            Crear tu primer reclamo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {reclamos.map((reclamo) => (
            <div
              key={reclamo.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{reclamo.title}</p>
                  <p className="mt-0.5 text-xs text-slate2">
                    {CATEGORY_LABELS[reclamo.category] ?? reclamo.category}
                    {reclamo.property?.address ? ` · ${reclamo.property.address}` : ""}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <PriorityBadge priority={reclamo.priority} />
                  <ReclamoStatusBadge status={reclamo.status} />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate2">
                Enviado el {formatDate(reclamo.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* New reclamo dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Reclamo</DialogTitle>
            <DialogDescription>
              Completá el formulario para enviar un reclamo al administrador.
            </DialogDescription>
          </DialogHeader>

          {contact ? (
            <NewReclamoForm
              contactId={contact.id}
              orgId={contact.org_id}
              onSuccess={() => setDialogOpen(false)}
              onCancel={() => setDialogOpen(false)}
            />
          ) : (
            <p className="text-sm text-slate2">
              No se encontró tu perfil de contacto. Contactá al administrador.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
