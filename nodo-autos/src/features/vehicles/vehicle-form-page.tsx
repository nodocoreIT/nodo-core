import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nodocore/shared-components";
import { useVehicleStore } from "@/store/vehicle-store";
import { generateVehicleSlug } from "@/shared/lib/utils";
import type { VehicleStatus, VehicleCondition, FuelType, Currency } from "@/types";

const vehicleSchema = z.object({
  brand: z.string().min(1, "Marca requerida"),
  model: z.string().min(1, "Modelo requerido"),
  version: z.string().optional(),
  year: z.coerce.number().min(1900).max(new Date().getFullYear() + 2),
  color: z.string().optional(),
  fuelType: z.enum(["Diésel", "Eléctrico", "Nafta", "Nafta/GNC", "GNC", "Híbrido"]),
  transmission: z.enum(["manual", "automatica"]).optional(),
  doors: z.coerce.number().optional(),
  kilometers: z.coerce.number().min(0),
  condition: z.enum(["nuevo", "usado"]),
  status: z.enum(["disponible", "reservado", "vendido", "en_preparacion"]),
  currency: z.enum(["ARS", "USD"]),
  listPrice: z.coerce.number().min(0),
  cashPrice: z.coerce.number().optional(),
  showPrice: z.boolean(),
  entryDate: z.string().min(1, "Fecha de ingreso requerida"),
  ownerType: z.enum(["own", "consignment"]),
  margin: z.coerce.number().optional(),
  expenses: z.coerce.number().optional(),
  description: z.string(),
  internalNotes: z.string().optional(),
  licensePlate: z.string().optional(),
  vin: z.string().optional(),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

export function VehicleFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const { getVehicleById, addVehicle, updateVehicle, currentCliente, loadInitialData } =
    useVehicleStore();

  const existing = id ? getVehicleById(id) : undefined;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      condition: "usado",
      status: "disponible",
      currency: "ARS",
      fuelType: "Nafta",
      ownerType: "own",
      showPrice: true,
      year: new Date().getFullYear(),
      kilometers: 0,
      listPrice: 0,
      entryDate: new Date().toISOString().split("T")[0],
      description: "",
    },
  });

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (existing) {
      reset({
        brand: existing.brand,
        model: existing.model,
        version: existing.version ?? "",
        year: existing.year,
        color: existing.color ?? "",
        fuelType: existing.fuelType,
        transmission: existing.transmission,
        doors: existing.doors,
        kilometers: existing.kilometers,
        condition: existing.condition,
        status: existing.status,
        currency: existing.currency,
        listPrice: existing.listPrice,
        cashPrice: existing.cashPrice,
        showPrice: existing.showPrice,
        entryDate: existing.entryDate,
        ownerType: existing.ownerType,
        margin: existing.margin,
        expenses: existing.expenses,
        description: existing.description,
        internalNotes: existing.internalNotes ?? "",
        licensePlate: existing.licensePlate ?? "",
        vin: existing.vin ?? "",
      });
    }
  }, [existing, reset]);

  async function onSubmit(values: VehicleFormValues) {
    if (!currentCliente) {
      toast.error("No se pudo identificar la concesionaria");
      return;
    }

    const slug =
      existing?.publicSlug ??
      generateVehicleSlug({
        brand: values.brand,
        model: values.model,
        licensePlate: values.licensePlate,
      });

    const payload = {
      clienteId: currentCliente.id,
      brand: values.brand,
      model: values.model,
      version: values.version || undefined,
      year: values.year,
      color: values.color || undefined,
      fuelType: values.fuelType as FuelType,
      transmission: values.transmission,
      doors: values.doors as 3 | 4 | 5 | undefined,
      kilometers: values.kilometers,
      condition: values.condition as VehicleCondition,
      status: values.status as VehicleStatus,
      currency: values.currency as Currency,
      listPrice: values.listPrice,
      cashPrice: values.cashPrice,
      showPrice: values.showPrice,
      entryDate: values.entryDate,
      ownerType: values.ownerType,
      margin: values.margin,
      expenses: values.expenses,
      description: values.description,
      internalNotes: values.internalNotes || undefined,
      licensePlate: values.licensePlate || undefined,
      vin: values.vin || undefined,
      publicSlug: slug,
      isPublished: existing?.isPublished ?? false,
      features: existing?.features ?? [],
      photos: existing?.photos ?? [],
      documents: existing?.documents ?? [],
      tags: existing?.tags ?? [],
    };

    try {
      if (isEdit && id) {
        await updateVehicle(id, payload);
        toast.success("Vehículo actualizado");
      } else {
        await addVehicle(payload);
        toast.success("Vehículo creado");
      }
      navigate("/admin/vehiculos");
    } catch {
      toast.error("Error al guardar el vehículo");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-slate2 hover:text-navy transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <h2 className="text-xl font-bold text-navy">
        {isEdit ? "Editar vehículo" : "Nuevo vehículo"}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Identificación */}
        <Card className="border-slate-200 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-slate2 uppercase tracking-wide">Identificación</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label="Marca *" error={errors.brand?.message}>
              <Input {...register("brand")} placeholder="Toyota" />
            </FormField>
            <FormField label="Modelo *" error={errors.model?.message}>
              <Input {...register("model")} placeholder="Corolla" />
            </FormField>
            <FormField label="Versión">
              <Input {...register("version")} placeholder="XEi CVT" />
            </FormField>
            <FormField label="Año *" error={errors.year?.message}>
              <Input type="number" {...register("year")} />
            </FormField>
            <FormField label="Color">
              <Input {...register("color")} placeholder="Blanco perla" />
            </FormField>
            <FormField label="Patente">
              <Input {...register("licensePlate")} placeholder="AB 123 CD" />
            </FormField>
            <FormField label="VIN / Chasis">
              <Input {...register("vin")} placeholder="9BWZZZ377VT004251" />
            </FormField>
            <FormField label="Combustible">
              <select
                {...register("fuelType")}
                className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option>Nafta</option>
                <option>Diésel</option>
                <option>Nafta/GNC</option>
                <option>GNC</option>
                <option>Híbrido</option>
                <option>Eléctrico</option>
              </select>
            </FormField>
            <FormField label="Transmisión">
              <select
                {...register("transmission")}
                className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="">Sin especificar</option>
                <option value="manual">Manual</option>
                <option value="automatica">Automática</option>
              </select>
            </FormField>
            <FormField label="Puertas">
              <select
                {...register("doors")}
                className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="">Sin especificar</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </FormField>
            <FormField label="Kilómetros *" error={errors.kilometers?.message}>
              <Input type="number" {...register("kilometers")} />
            </FormField>
            <FormField label="Condición">
              <select
                {...register("condition")}
                className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="usado">Usado</option>
                <option value="nuevo">Nuevo</option>
              </select>
            </FormField>
          </CardContent>
        </Card>

        {/* Precio */}
        <Card className="border-slate-200 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-slate2 uppercase tracking-wide">Precio</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label="Moneda">
              <select
                {...register("currency")}
                className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="ARS">ARS — Pesos</option>
                <option value="USD">USD — Dólares</option>
              </select>
            </FormField>
            <FormField label="Precio lista *" error={errors.listPrice?.message}>
              <Input type="number" {...register("listPrice")} />
            </FormField>
            <FormField label="Precio contado">
              <Input type="number" {...register("cashPrice")} />
            </FormField>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="showPrice" {...register("showPrice")} className="h-4 w-4 accent-brand" />
              <Label htmlFor="showPrice" className="text-sm">Mostrar precio al público</Label>
            </div>
          </CardContent>
        </Card>

        {/* Comercial */}
        <Card className="border-slate-200 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-slate2 uppercase tracking-wide">Comercial</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label="Fecha de ingreso *" error={errors.entryDate?.message}>
              <Input type="date" {...register("entryDate")} />
            </FormField>
            <FormField label="Tipo de tenencia">
              <select
                {...register("ownerType")}
                className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="own">Propio</option>
                <option value="consignment">Consignación</option>
              </select>
            </FormField>
            <FormField label="Estado">
              <select
                {...register("status")}
                className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="disponible">Disponible</option>
                <option value="reservado">Reservado</option>
                <option value="en_preparacion">En preparación</option>
                <option value="vendido">Vendido</option>
              </select>
            </FormField>
            <FormField label="Margen ($)">
              <Input type="number" {...register("margin")} />
            </FormField>
            <FormField label="Gastos ($)">
              <Input type="number" {...register("expenses")} />
            </FormField>
          </CardContent>
        </Card>

        {/* Descripción */}
        <Card className="border-slate-200 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-slate2 uppercase tracking-wide">Descripción pública</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              {...register("description")}
              rows={4}
              placeholder="Describí el vehículo para los clientes…"
              className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink placeholder:text-slate2-300 focus:outline-none focus:ring-2 focus:ring-brand resize-none"
            />
          </CardContent>
        </Card>

        {/* Notas internas */}
        <Card className="border-slate-200 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-slate2 uppercase tracking-wide">Notas internas</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              {...register("internalNotes")}
              rows={3}
              placeholder="Solo visible para el equipo…"
              className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink placeholder:text-slate2-300 focus:outline-none focus:ring-2 focus:ring-brand resize-none"
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand hover:bg-brand-600 text-white gap-2"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? "Guardando…" : "Guardar vehículo"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium text-ink">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
