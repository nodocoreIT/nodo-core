import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Car, CheckCircle2, Tag, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@nodocore/shared-components";
import { useVehicleStore } from "@/store/vehicle-store";
import { formatPrice, formatDate } from "@/shared/lib/utils";
import type { VehicleStatus } from "@/types";

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

export function DashboardPage() {
  const { vehicles, loadInitialData, loading, error } = useVehicleStore();
  const navigate = useNavigate();

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const total = vehicles.length;
  const disponibles = vehicles.filter((v) => v.status === "disponible").length;
  const vendidos = vehicles.filter((v) => v.status === "vendido").length;
  const publicados = vehicles.filter((v) => v.isPublished).length;

  const recent = [...vehicles]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const stats = [
    { label: "Total Stock", value: total, icon: Car, color: "text-navy" },
    { label: "Disponibles", value: disponibles, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Vendidos", value: vendidos, icon: Tag, color: "text-slate2" },
    { label: "Publicados", value: publicados, icon: Globe, color: "text-brand" },
  ];

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-semibold mb-1">Error cargando datos</p>
        <pre className="whitespace-pre-wrap text-xs">{error}</pre>
        <button onClick={() => loadInitialData(true)} className="mt-3 rounded px-3 py-1.5 bg-red-600 text-white text-xs hover:bg-red-700">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-slate-200 rounded-xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate2">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${color}`}>{loading ? "–" : value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent vehicles */}
      <Card className="border-slate-200 rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base text-navy">Últimos vehículos ingresados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="px-6 py-4 text-sm text-slate2">Cargando…</p>
          ) : recent.length === 0 ? (
            <p className="px-6 py-4 text-sm text-slate2">Sin vehículos aún.</p>
          ) : (
            <div className="divide-y divide-mist">
              {recent.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => navigate(`/admin/vehiculos/${v.id}`)}
                  className="flex w-full items-center gap-4 px-6 py-3 text-left hover:bg-mist-200 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="h-12 w-16 flex-shrink-0 overflow-hidden rounded-md bg-mist">
                    {v.photos[0] ? (
                      <img
                        src={v.photos[0]}
                        alt={`${v.brand} ${v.model}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Car className="h-5 w-5 text-slate2-300" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">
                      {v.brand} {v.model}
                      {v.version ? ` ${v.version}` : ""}
                    </p>
                    <p className="text-xs text-slate2">
                      {v.year} · {formatDate(v.createdAt)}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[v.status]}`}
                  >
                    {STATUS_LABEL[v.status]}
                  </span>

                  {/* Price */}
                  <p className="hidden sm:block text-sm font-semibold text-navy flex-shrink-0">
                    {v.showPrice ? formatPrice(v.cashPrice ?? v.listPrice, v.currency) : "—"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
