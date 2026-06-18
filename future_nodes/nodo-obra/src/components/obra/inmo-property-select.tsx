"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { obraApi } from "@/lib/obra/client-api";
import type { InmoPropertyOption } from "@/lib/obra/types";

interface InmoPropertySelectProps {
  value: string;
  label: string;
  disabled?: boolean;
  onChange: (propertyId: string, propertyLabel: string, property: InmoPropertyOption | null) => void;
}

export function InmoPropertySelect({
  value,
  label,
  disabled,
  onChange,
}: InmoPropertySelectProps) {
  const [properties, setProperties] = useState<InmoPropertyOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    obraApi
      .getInmoProperties()
      .then((d) => setProperties(d.properties))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-brand" />
        {label}
      </Label>
      <select
        disabled={disabled || loading}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(e) => {
          const property = properties.find((p) => p.id === e.target.value) ?? null;
          onChange(
            e.target.value,
            property ? `${property.address} (${property.propertyType})` : "",
            property,
          );
        }}
      >
        <option value="">
          {loading ? "Cargando propiedades…" : "Sin vincular a nodo-inmo"}
        </option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.address} · {p.propertyType} · {p.ownerName}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate2">
        Vinculá la obra o presupuesto con una propiedad del módulo inmobiliario.
      </p>
    </div>
  );
}
