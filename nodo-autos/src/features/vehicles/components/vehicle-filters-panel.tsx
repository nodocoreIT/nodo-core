import { Label, Input, FormSelect } from "@nodocore/shared-components";
import type { VehicleFilters } from "@/types";
import {
  formatCurrencyInput,
  formatThousands,
  parseDigitsToNumber,
} from "@/utils/contract-calculations";
import { cn } from "@/shared/lib/utils";
import {
  FUEL_TYPE_OPTIONS,
  TRANSMISSION_OPTIONS,
  VEHICLE_CONDITION_OPTIONS,
  VEHICLE_STATUS_OPTIONS,
} from "../lib/vehicle-filter-options";

const fieldClass =
  "w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand";

interface VehicleFiltersPanelProps {
  filters: VehicleFilters;
  onChange: <K extends keyof VehicleFilters>(key: K, value: VehicleFilters[K]) => void;
  onClear: () => void;
  className?: string;
}

export function VehicleFiltersPanel({
  filters,
  onChange,
  onClear,
  className,
}: VehicleFiltersPanelProps) {
  return (
    <div className={cn("border-t border-mist pt-4", className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <FilterSelect
          label="Estado"
          value={filters.status ?? ""}
          onChange={(value) =>
            onChange("status", value ? (value as VehicleFilters["status"]) : undefined)
          }
          options={VEHICLE_STATUS_OPTIONS}
          placeholder="Todos"
        />

        <FilterSelect
          label="Condición"
          value={filters.condition ?? ""}
          onChange={(value) =>
            onChange("condition", value ? (value as VehicleFilters["condition"]) : undefined)
          }
          options={VEHICLE_CONDITION_OPTIONS}
          placeholder="Todos"
        />

        <FilterSelect
          label="Combustible"
          value={filters.fuelType ?? ""}
          onChange={(value) =>
            onChange("fuelType", value ? (value as VehicleFilters["fuelType"]) : undefined)
          }
          options={FUEL_TYPE_OPTIONS}
          placeholder="Todos"
        />

        <FilterSelect
          label="Transmisión"
          value={filters.transmission ?? ""}
          onChange={(value) =>
            onChange(
              "transmission",
              value ? (value as VehicleFilters["transmission"]) : undefined,
            )
          }
          options={TRANSMISSION_OPTIONS}
          placeholder="Todas"
        />

        <div>
          <Label className="mb-1 text-sm font-medium text-navy">Año desde</Label>
          <Input
            type="number"
            placeholder="2020"
            value={filters.yearFrom ?? ""}
            onChange={(e) =>
              onChange("yearFrom", e.target.value ? parseInt(e.target.value, 10) : undefined)
            }
            className={fieldClass}
          />
        </div>

        <div>
          <Label className="mb-1 text-sm font-medium text-navy">Año hasta</Label>
          <Input
            type="number"
            placeholder="2024"
            value={filters.yearTo ?? ""}
            onChange={(e) =>
              onChange("yearTo", e.target.value ? parseInt(e.target.value, 10) : undefined)
            }
            className={fieldClass}
          />
        </div>

        <div>
          <Label className="mb-1 text-sm font-medium text-navy">Precio desde</Label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="$ 1.000.000"
            value={
              filters.priceFrom !== undefined
                ? formatCurrencyInput(filters.priceFrom, "ARS")
                : ""
            }
            onChange={(e) =>
              onChange(
                "priceFrom",
                e.target.value ? parseDigitsToNumber(e.target.value) : undefined,
              )
            }
            className={fieldClass}
          />
        </div>

        <div>
          <Label className="mb-1 text-sm font-medium text-navy">Precio hasta</Label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="$ 999.000.000"
            value={
              filters.priceTo !== undefined ? formatCurrencyInput(filters.priceTo, "ARS") : ""
            }
            onChange={(e) =>
              onChange(
                "priceTo",
                e.target.value ? parseDigitsToNumber(e.target.value) : undefined,
              )
            }
            className={fieldClass}
          />
        </div>

        <div>
          <Label className="mb-1 text-sm font-medium text-navy">Kms desde</Label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="Mínimo"
            value={
              filters.kilometersFrom !== undefined
                ? formatThousands(filters.kilometersFrom)
                : ""
            }
            onChange={(e) =>
              onChange(
                "kilometersFrom",
                e.target.value ? parseDigitsToNumber(e.target.value) : undefined,
              )
            }
            className={fieldClass}
          />
        </div>

        <div>
          <Label className="mb-1 text-sm font-medium text-navy">Kms hasta</Label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="Máximo"
            value={
              filters.kilometersTo !== undefined
                ? formatThousands(filters.kilometersTo)
                : ""
            }
            onChange={(e) =>
              onChange(
                "kilometersTo",
                e.target.value ? parseDigitsToNumber(e.target.value) : undefined,
              )
            }
            className={fieldClass}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClear}
          className="text-sm font-medium text-brand hover:text-brand-600"
        >
          Limpiar filtros
        </button>
      </div>
    </div>
  );
}

interface FilterSelectProps<T extends string> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: T; label: string }[];
  placeholder: string;
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder,
}: FilterSelectProps<T>) {
  return (
    <div>
      <Label className="mb-1 text-sm font-medium text-navy">{label}</Label>
      <FormSelect
        value={value}
        onChange={(next) => onChange(next as T)}
        options={options}
        allowEmpty
        emptyLabel={placeholder}
      />
    </div>
  );
}

export function countActiveVehicleFilters(filters: VehicleFilters): number {
  return (
    Number(Boolean(filters.status)) +
    Number(Boolean(filters.condition)) +
    Number(Boolean(filters.fuelType)) +
    Number(Boolean(filters.transmission)) +
    Number(filters.yearFrom !== undefined) +
    Number(filters.yearTo !== undefined) +
    Number(filters.priceFrom !== undefined) +
    Number(filters.priceTo !== undefined) +
    Number(filters.kilometersFrom !== undefined) +
    Number(filters.kilometersTo !== undefined)
  );
}
