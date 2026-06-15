import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LayoutGrid, List, Search, Pencil, Trash2, Car } from "lucide-react";
import {
  Button,
  Input,
  Card,
  CardContent,
} from "@nodocore/shared-components";
import { useVehicleStore } from "@/store/vehicle-store";
import { formatPrice, formatKilometers } from "@/shared/lib/utils";
import { cn } from "@/shared/lib/utils";
import type { VehicleStatus, VehicleCondition, Vehicle } from "@/types";
import { toast } from "sonner";

const STATUS_BADGE: Record<VehicleStatus, string> = {
  disponible: "status-disponible",
  reservado: "status-reservado",
  vendido: "status-vendido",
  en_preparacion: "status-en_preparacion",
};

const STATUS_LABEL: Record<VehicleStatus, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  vendido: "Vendido",
  en_preparacion: "En preparación",
};

export function VehiclesListPage() {
  const navigate = useNavigate();
  const { vehicles, loadInitialData, deleteVehicle, loading } = useVehicleStore();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "">("");
  const [conditionFilter, setConditionFilter] = useState<VehicleCondition | "">("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const filtered = vehicles.filter((v) => {
    if (statusFilter && v.status !== statusFilter) return false;
    if (conditionFilter && v.condition !== conditionFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !v.brand.toLowerCase().includes(s) &&
        !v.model.toLowerCase().includes(s) &&
        !(v.version ?? "").toLowerCase().includes(s) &&
        !String(v.year).includes(s)
      )
        return false;
    }
    return true;
  });

  async function handleDelete(id: string) {
    try {
      await deleteVehicle(id);
      toast.success("Vehículo eliminado");
      setConfirmDelete(null);
    } catch {
      toast.error("No se pudo eliminar el vehículo");
    }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-navy">Stock de vehículos</h2>
        <Button
          onClick={() => navigate("/admin/vehiculos/nuevo")}
          className="bg-brand hover:bg-brand-600 text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          Nuevo vehículo
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate2" />
          <Input
            placeholder="Buscar por marca, modelo, año…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as VehicleStatus | "")}
          className="rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">Todos los estados</option>
          <option value="disponible">Disponible</option>
          <option value="reservado">Reservado</option>
          <option value="vendido">Vendido</option>
          <option value="en_preparacion">En preparación</option>
        </select>

        <select
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value as VehicleCondition | "")}
          className="rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">Condición</option>
          <option value="nuevo">Nuevo</option>
          <option value="usado">Usado</option>
        </select>

        <div className="flex rounded-md border border-mist overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={cn(
              "px-3 py-2 transition-colors",
              viewMode === "grid" ? "bg-navy text-white" : "bg-white text-slate2 hover:bg-mist",
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "px-3 py-2 transition-colors",
              viewMode === "list" ? "bg-navy text-white" : "bg-white text-slate2 hover:bg-mist",
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-slate2">
        {filtered.length} vehículo{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Loading */}
      {loading && <p className="text-sm text-slate2">Cargando…</p>}

      {/* Grid view */}
      {!loading && viewMode === "grid" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              onEdit={() => navigate(`/admin/vehiculos/${v.id}/editar`)}
              onView={() => navigate(`/admin/vehiculos/${v.id}`)}
              onDelete={() => setConfirmDelete(v.id)}
            />
          ))}
        </div>
      )}

      {/* List view */}
      {!loading && viewMode === "list" && (
        <Card className="border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="divide-y divide-mist">
              {filtered.map((v) => (
                <VehicleRow
                  key={v.id}
                  vehicle={v}
                  onEdit={() => navigate(`/admin/vehiculos/${v.id}/editar`)}
                  onView={() => navigate(`/admin/vehiculos/${v.id}`)}
                  onDelete={() => setConfirmDelete(v.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Car className="h-10 w-10 text-slate2-300" />
          <p className="text-slate2">No hay vehículos que coincidan con los filtros.</p>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-base font-semibold text-navy mb-2">¿Eliminar vehículo?</h3>
            <p className="text-sm text-slate2 mb-6">
              Esta acción no se puede deshacer. El vehículo será eliminado permanentemente.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => handleDelete(confirmDelete)}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface VehicleCardProps {
  vehicle: Vehicle;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function VehicleCard({ vehicle: v, onView, onEdit, onDelete }: VehicleCardProps) {
  return (
    <Card className="border-slate-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Photo */}
      <button type="button" onClick={onView} className="block w-full">
        <div className="h-40 bg-mist overflow-hidden">
          {v.photos[0] ? (
            <img
              src={v.photos[0]}
              alt={`${v.brand} ${v.model}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Car className="h-10 w-10 text-slate2-300" />
            </div>
          )}
        </div>
      </button>

      <CardContent className="p-4 space-y-2">
        {/* Title */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-navy text-sm leading-tight">
              {v.brand} {v.model}
            </p>
            {v.version && (
              <p className="text-xs text-slate2">{v.version}</p>
            )}
          </div>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold flex-shrink-0 ${STATUS_BADGE[v.status]}`}>
            {STATUS_LABEL[v.status]}
          </span>
        </div>

        {/* Details */}
        <p className="text-xs text-slate2">
          {v.year} · {formatKilometers(v.kilometers)}
        </p>

        {/* Price */}
        <p className="text-sm font-bold text-navy">
          {v.showPrice ? formatPrice(v.cashPrice ?? v.listPrice, v.currency) : "Consultar"}
        </p>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1 text-xs"
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function VehicleRow({ vehicle: v, onView, onEdit, onDelete }: VehicleCardProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      {/* Thumbnail */}
      <button type="button" onClick={onView} className="flex-shrink-0">
        <div className="h-10 w-14 overflow-hidden rounded-md bg-mist">
          {v.photos[0] ? (
            <img
              src={v.photos[0]}
              alt={`${v.brand} ${v.model}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Car className="h-4 w-4 text-slate2-300" />
            </div>
          )}
        </div>
      </button>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy truncate">
          {v.brand} {v.model} {v.version ?? ""} {v.year}
        </p>
        <p className="text-xs text-slate2">{formatKilometers(v.kilometers)}</p>
      </div>

      {/* Status */}
      <span className={`hidden sm:inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[v.status]}`}>
        {STATUS_LABEL[v.status]}
      </span>

      {/* Price */}
      <p className="hidden md:block text-sm font-semibold text-navy flex-shrink-0">
        {v.showPrice ? formatPrice(v.cashPrice ?? v.listPrice, v.currency) : "—"}
      </p>

      {/* Actions */}
      <div className="flex gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md p-1.5 text-slate2 hover:text-navy hover:bg-mist transition-colors"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-1.5 text-slate2 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
