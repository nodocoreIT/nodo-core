import { Home } from "lucide-react";
import { useMyProperties, type OwnerProperty } from "../hooks/use-my-properties";
import { cn } from "@/shared/lib/utils";

// ── Label maps ────────────────────────────────────────────────────────────────

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: "Departamento",
  house: "Casa",
  commercial: "Local",
  land: "Terreno",
  other: "Otro",
};

const OPERATION_LABELS: Record<string, string> = {
  rent: "Alquiler",
  sale: "Venta",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  available: {
    label: "Disponible",
    className: "bg-green-100 text-green-800",
  },
  rented: {
    label: "Alquilada",
    className: "bg-blue-100 text-blue-800",
  },
  reserved: {
    label: "Reservada",
    className: "bg-yellow-100 text-yellow-800",
  },
  sold: {
    label: "Vendida",
    className: "bg-gray-100 text-gray-600",
  },
  inactive: {
    label: "Inactiva",
    className: "bg-gray-100 text-gray-600",
  },
};

// ── Property card ─────────────────────────────────────────────────────────────

function PropertyCard({ property }: { property: OwnerProperty }) {
  const statusConfig = STATUS_CONFIG[property.status ?? ""] ?? {
    label: property.status ?? "—",
    className: "bg-gray-100 text-gray-600",
  };

  const formattedPrice =
    property.sale_price && property.currency
      ? new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: property.currency,
          minimumFractionDigits: 0,
        }).format(property.sale_price)
      : null;

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-navy leading-snug">{property.address}</h3>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
            statusConfig.className,
          )}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate2">
        {property.property_type && (
          <span>{PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type}</span>
        )}
        {property.operation && (
          <span>{OPERATION_LABELS[property.operation] ?? property.operation}</span>
        )}
        {property.total_sqm && <span>{property.total_sqm} m²</span>}
        {property.rooms && <span>{property.rooms} amb.</span>}
      </div>

      {/* Price */}
      {formattedPrice && (
        <p className="text-base font-bold text-navy">{formattedPrice}</p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function OwnerPropertiesPage() {
  const { data: properties = [], isLoading, error } = useMyProperties();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate2">Cargando propiedades...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">No se pudieron cargar las propiedades.</p>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mist">
          <Home className="h-7 w-7 text-slate2" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-navy">Sin propiedades</p>
          <p className="mt-1 text-sm text-slate2">
            Todavía no tenés propiedades asociadas a tu cuenta.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate2">
          {properties.length} {properties.length === 1 ? "propiedad" : "propiedades"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </div>
  );
}
