import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Car, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@nodocore/shared-components";
import { useVehicleStore } from "@/store/vehicle-store";
import { formatPrice, formatKilometers, formatDate } from "@/shared/lib/utils";
import type { VehicleStatus } from "@/types";
import { VehicleTabBar, type VehicleTab } from "@/features/vehicles/components/vehicle-tab-bar";
import { VehicleQrPanel } from "@/features/vehicles/components/vehicle-qr-panel";
import { VehicleDocumentsPanel } from "@/features/vehicles/components/vehicle-documents-panel";

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

export function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getVehicleById, loadInitialData, currentCliente } = useVehicleStore();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<VehicleTab>("datos");

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const vehicle = id ? getVehicleById(id) : undefined;

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Car className="h-10 w-10 text-slate2-300" />
        <p className="text-slate2">Vehículo no encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/admin/vehiculos")}>
          Volver al listado
        </Button>
      </div>
    );
  }

  const photos = vehicle.photos;

  return (
    <div className="space-y-6 w-full max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate2 hover:text-navy transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
        <Button
          onClick={() => navigate(`/admin/vehiculos/${vehicle.id}/editar`)}
          className="bg-brand hover:bg-brand-600 text-white gap-2"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </Button>
      </div>

      <div className="flex items-start gap-4 overflow-visible">
        {photos.length > 0 ? (
          <button
            type="button"
            onClick={() => setActiveTab("fotos")}
            className="group relative h-14 w-14 shrink-0 cursor-zoom-in"
            title="Ver fotos"
          >
            <img
              src={photos[0]}
              alt={`${vehicle.brand} ${vehicle.model}`}
              className="absolute inset-0 h-14 w-14 rounded-lg object-cover border border-mist transition-all duration-200 ease-out origin-top-left group-hover:scale-[2.25] group-hover:shadow-xl group-hover:z-50 group-hover:rounded-xl"
            />
          </button>
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-mist shrink-0">
            <Car className="h-6 w-6 text-slate2-300" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-navy">
            {vehicle.brand} {vehicle.model}
            {vehicle.version ? ` ${vehicle.version}` : ""}
          </h2>
          <p className="text-slate2">{vehicle.year}</p>
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold mt-1 ${STATUS_BADGE[vehicle.status]}`}>
          {STATUS_LABEL[vehicle.status]}
        </span>
      </div>

      <VehicleTabBar activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "datos" && (
        <div className="space-y-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="border-slate-200 rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm text-slate2 uppercase tracking-wide">Identificación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <DetailRow label="Marca" value={vehicle.brand} />
                <DetailRow label="Modelo" value={vehicle.model} />
                {vehicle.version && <DetailRow label="Versión" value={vehicle.version} />}
                <DetailRow label="Año" value={String(vehicle.year)} />
                {vehicle.color && <DetailRow label="Color" value={vehicle.color} />}
                <DetailRow label="Combustible" value={vehicle.fuelType} />
                {vehicle.transmission && (
                  <DetailRow
                    label="Transmisión"
                    value={vehicle.transmission === "automatica" ? "Automática" : "Manual"}
                  />
                )}
                {vehicle.doors && <DetailRow label="Puertas" value={String(vehicle.doors)} />}
                <DetailRow label="Kilómetros" value={formatKilometers(vehicle.kilometers)} />
                <DetailRow label="Condición" value={vehicle.condition === "nuevo" ? "Nuevo" : "Usado"} />
                {vehicle.licensePlate && <DetailRow label="Patente" value={vehicle.licensePlate} />}
                {vehicle.vin && <DetailRow label="VIN" value={vehicle.vin} />}
              </CardContent>
            </Card>

            <Card className="border-slate-200 rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm text-slate2 uppercase tracking-wide">Precio y comercial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <DetailRow label="Precio lista" value={formatPrice(vehicle.listPrice, vehicle.currency)} />
                {vehicle.cashPrice && (
                  <DetailRow label="Precio contado" value={formatPrice(vehicle.cashPrice, vehicle.currency)} />
                )}
                <DetailRow label="Mostrar precio" value={vehicle.showPrice ? "Sí" : "No"} />
                <DetailRow
                  label="Tipo de tenencia"
                  value={vehicle.ownerType === "own" ? "Propio" : "Consignación"}
                />
                <DetailRow label="Fecha ingreso" value={formatDate(vehicle.entryDate)} />
                {vehicle.margin !== undefined && (
                  <DetailRow label="Margen" value={formatPrice(vehicle.margin, vehicle.currency)} />
                )}
                {vehicle.expenses !== undefined && (
                  <DetailRow label="Gastos" value={formatPrice(vehicle.expenses, vehicle.currency)} />
                )}
                <DetailRow label="Publicado" value={vehicle.isPublished ? "Sí" : "No"} />
              </CardContent>
            </Card>
          </div>

          {vehicle.description && (
            <Card className="border-slate-200 rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm text-slate2 uppercase tracking-wide">Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-ink whitespace-pre-wrap">{vehicle.description}</p>
              </CardContent>
            </Card>
          )}

          <div className="text-xs text-slate2 space-y-1">
            <p>Creado: {formatDate(vehicle.createdAt)} — por {vehicle.createdBy}</p>
            <p>Actualizado: {formatDate(vehicle.updatedAt)} — por {vehicle.updatedBy}</p>
          </div>
        </div>
      )}

      {activeTab === "fotos" && (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-mist aspect-video max-h-[420px]">
            {photos.length > 0 ? (
              <>
                <img
                  src={photos[photoIndex]}
                  alt={`${vehicle.brand} ${vehicle.model} foto ${photoIndex + 1}`}
                  className="h-full w-full object-cover"
                />
                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 shadow hover:bg-white transition"
                    >
                      <ChevronLeft className="h-5 w-5 text-navy" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 shadow hover:bg-white transition"
                    >
                      <ChevronRight className="h-5 w-5 text-navy" />
                    </button>
                    <span className="absolute bottom-3 right-3 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
                      {photoIndex + 1} / {photos.length}
                    </span>
                  </>
                )}
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Car className="h-16 w-16 text-slate2-300" />
              </div>
            )}
          </div>

          {photos.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {photos.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setPhotoIndex(index)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition ${
                    index === photoIndex ? "border-brand" : "border-transparent hover:border-mist"
                  }`}
                >
                  <img src={url} alt={`Miniatura ${index + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "qr" && (
        <Card className="border-slate-200 rounded-xl shadow-sm">
          <CardContent className="pt-6">
            <VehicleQrPanel
              vehicle={vehicle}
              clienteIdentificador={currentCliente?.identificador}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "documentacion" && (
        <Card className="border-slate-200 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-slate2 uppercase tracking-wide">
              Documentación del vehículo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VehicleDocumentsPanel documents={vehicle.documents} onChange={() => {}} readOnly />
          </CardContent>
        </Card>
      )}

      {activeTab === "notas" && (
        <Card className="border-slate-200 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-slate2 uppercase tracking-wide">Notas internas</CardTitle>
          </CardHeader>
          <CardContent>
            {vehicle.internalNotes ? (
              <p className="text-sm text-ink whitespace-pre-wrap rounded-lg bg-amber-50 border border-amber-100 p-4">
                {vehicle.internalNotes}
              </p>
            ) : (
              <p className="text-sm text-slate2">No hay notas internas para este vehículo.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-slate2 shrink-0">{label}</span>
      <span className="text-sm text-navy text-right">{value}</span>
    </div>
  );
}
