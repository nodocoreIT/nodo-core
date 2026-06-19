import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Save, Upload, X, Plus, ImageIcon, GripVertical } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nodocore/shared-components";
import { VehicleTabBar, type VehicleTab } from "@/features/vehicles/components/vehicle-tab-bar";
import { VehicleQrPanel } from "@/features/vehicles/components/vehicle-qr-panel";
import { VehicleDocumentsPanel } from "@/features/vehicles/components/vehicle-documents-panel";
import type { VehicleDocument } from "@/types";
import { useVehicleStore } from "@/store/vehicle-store";
import { supabase } from "@/shared/lib/supabase";
import { generateVehicleSlug } from "@/shared/lib/utils";
import type { VehicleStatus, VehicleCondition, FuelType, Currency } from "@/types";

function formatCurrencyInput(value: string | number | null | undefined, currency: "ARS" | "USD" = "ARS"): string {
  if (value === null || value === undefined) return "";
  const clean = String(value).replace(/\D/g, "");
  if (!clean) return "";
  const formatted = Number(clean).toLocaleString("de-DE"); // formats with dot separator
  const prefix = currency === "ARS" ? "$ " : "US$ ";
  return `${prefix}${formatted}`;
}

function formatNumericInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const clean = String(value).replace(/\D/g, "");
  if (!clean) return "";
  return Number(clean).toLocaleString("de-DE");
}

function parseNumberInput(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const clean = String(value).replace(/\D/g, "");
  if (!clean) return null;
  const n = Number(clean);
  return isNaN(n) ? null : n;
}

const vehicleSchema = z.object({
  brand: z.string().min(1, "Marca requerida"),
  model: z.string().min(1, "Modelo requerido"),
  version: z.string().optional(),
  year: z.coerce.number().min(1900).max(new Date().getFullYear() + 2),
  color: z.string().optional(),
  fuelType: z.enum(["Diésel", "Eléctrico", "Nafta", "Nafta/GNC", "GNC", "Híbrido"]),
  transmission: z.enum(["manual", "automatica"]).optional(),
  doors: z.coerce.number().optional(),
  kilometers: z.string().min(1, "Kilómetros requeridos"),
  condition: z.enum(["nuevo", "usado"]),
  status: z.enum(["disponible", "reservado", "vendido", "en_preparacion"]),
  currency: z.enum(["ARS", "USD"]),
  listPrice: z.string().min(1, "Precio de lista requerido"),
  cashPrice: z.string().optional(),
  showPrice: z.boolean(),
  entryDate: z.string().min(1, "Fecha de ingreso requerida"),
  ownerType: z.enum(["own", "consignment"]),
  margin: z.string().optional(),
  expenses: z.string().optional(),
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

  // ── Photos state (outside RHF — managed manually) ──────────────────────────
  const [photos, setPhotos] = useState<string[]>(existing?.photos ?? []);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Features/equipment state ───────────────────────────────────────────────
  const [features, setFeatures] = useState<string[]>(existing?.features ?? []);
  const [featureInput, setFeatureInput] = useState("");
  const [documents, setDocuments] = useState<VehicleDocument[]>(existing?.documents ?? []);
  const [activeTab, setActiveTab] = useState<VehicleTab>("datos");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema) as import("react-hook-form").Resolver<VehicleFormValues>,
    defaultValues: {
      condition: "usado",
      status: "disponible",
      currency: "ARS",
      fuelType: "Nafta",
      ownerType: "own",
      showPrice: true,
      year: new Date().getFullYear(),
      kilometers: "0",
      listPrice: "",
      cashPrice: "",
      margin: "",
      expenses: "",
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
        kilometers: formatNumericInput(existing.kilometers),
        condition: existing.condition,
        status: existing.status,
        currency: existing.currency,
        listPrice: formatCurrencyInput(existing.listPrice, existing.currency),
        cashPrice: existing.cashPrice !== undefined && existing.cashPrice !== null ? formatCurrencyInput(existing.cashPrice, existing.currency) : "",
        showPrice: existing.showPrice,
        entryDate: existing.entryDate,
        ownerType: existing.ownerType,
        margin: existing.margin !== undefined && existing.margin !== null ? formatNumericInput(existing.margin) : "",
        expenses: existing.expenses !== undefined && existing.expenses !== null ? formatNumericInput(existing.expenses) : "",
        description: existing.description,
        internalNotes: existing.internalNotes ?? "",
        licensePlate: existing.licensePlate ?? "",
        vin: existing.vin ?? "",
      });
      setPhotos(existing.photos ?? []);
      setFeatures(existing.features ?? []);
      setDocuments(existing.documents ?? []);
    }
  }, [existing, reset]);

  const currency = watch("currency") || "ARS";
  const prevCurrencyRef = useRef(currency);

  useEffect(() => {
    if (prevCurrencyRef.current !== currency) {
      const currentPrice = watch("listPrice");
      if (currentPrice) {
        const raw = currentPrice.replace(/\D/g, "");
        setValue("listPrice", formatCurrencyInput(raw, currency));
      }
      const currentCashPrice = watch("cashPrice");
      if (currentCashPrice) {
        const raw = currentCashPrice.replace(/\D/g, "");
        setValue("cashPrice", formatCurrencyInput(raw, currency));
      }
      prevCurrencyRef.current = currency;
    }
  }, [currency, setValue, watch]);

  // ── Photo upload ───────────────────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhotos(true);
    const uploaded: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} no es una imagen válida`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} supera los 5MB`);
          continue;
        }

        const ext = file.name.split(".").pop();
        const path = `${currentCliente?.id ?? "demo"}/${Date.now()}-${i}.${ext}`;

        const { error } = await supabase.storage
          .from("vehicle-photos")
          .upload(path, file, { upsert: false });

        if (error) {
          toast.error(`Error subiendo ${file.name}: ${error.message}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("vehicle-photos")
          .getPublicUrl(path);

        uploaded.push(urlData.publicUrl);
      }

      setPhotos((prev) => [...prev, ...uploaded]);
      if (uploaded.length > 0) toast.success(`${uploaded.length} foto(s) subida(s)`);
    } catch (err) {
      toast.error("Error al subir fotos");
    } finally {
      setUploadingPhotos(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) =>
    setPhotos((prev) => prev.filter((_, i) => i !== index));

  const movePhoto = (from: number, to: number) => {
    setPhotos((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  // ── Features ──────────────────────────────────────────────────────────────
  const addFeature = () => {
    const val = featureInput.trim();
    if (val && !features.includes(val)) {
      setFeatures((prev) => [...prev, val]);
    }
    setFeatureInput("");
  };

  const removeFeature = (index: number) =>
    setFeatures((prev) => prev.filter((_, i) => i !== index));

  // ── Submit ─────────────────────────────────────────────────────────────────
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
      kilometers: parseNumberInput(values.kilometers) ?? 0,
      condition: values.condition as VehicleCondition,
      status: values.status as VehicleStatus,
      currency: values.currency as Currency,
      listPrice: parseNumberInput(values.listPrice) ?? 0,
      cashPrice: parseNumberInput(values.cashPrice) ?? undefined,
      showPrice: values.showPrice,
      entryDate: values.entryDate,
      ownerType: values.ownerType,
      margin: parseNumberInput(values.margin) ?? undefined,
      expenses: parseNumberInput(values.expenses) ?? undefined,
      description: values.description,
      internalNotes: values.internalNotes || undefined,
      licensePlate: values.licensePlate || undefined,
      vin: values.vin || undefined,
      publicSlug: slug,
      isPublished: existing?.isPublished ?? false,
      photos,
      features,
      documents,
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
    <div className="space-y-6 w-full max-w-6xl">
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

      <VehicleTabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        showExtendedTabs={isEdit && Boolean(existing)}
      />

      {isEdit && activeTab === "qr" && existing && (
        <Card className="border-slate-200 rounded-xl shadow-sm">
          <CardContent className="pt-6">
            <VehicleQrPanel
              vehicle={existing}
              clienteIdentificador={currentCliente?.identificador}
            />
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {activeTab === "datos" && (
          <>
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
              <select {...register("fuelType")} className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand">
                <option>Nafta</option>
                <option>Diésel</option>
                <option>Nafta/GNC</option>
                <option>GNC</option>
                <option>Híbrido</option>
                <option>Eléctrico</option>
              </select>
            </FormField>
            <FormField label="Transmisión">
              <select {...register("transmission")} className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="">Sin especificar</option>
                <option value="manual">Manual</option>
                <option value="automatica">Automática</option>
              </select>
            </FormField>
            <FormField label="Puertas">
              <select {...register("doors")} className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="">Sin especificar</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </FormField>
            <FormField label="Kilómetros *" error={errors.kilometers?.message}>
              <Input
                type="text"
                {...register("kilometers")}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setValue("kilometers", formatNumericInput(raw));
                }}
              />
            </FormField>
            <FormField label="Condición">
              <select {...register("condition")} className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand">
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
              <select {...register("currency")} className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="ARS">ARS — Pesos</option>
                <option value="USD">USD — Dólares</option>
              </select>
            </FormField>
            <FormField label="Precio lista *" error={errors.listPrice?.message}>
              <Input
                type="text"
                placeholder={currency === "ARS" ? "$ 0" : "US$ 0"}
                {...register("listPrice")}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setValue("listPrice", formatCurrencyInput(raw, currency));
                }}
              />
            </FormField>
            <FormField label="Precio contado">
              <Input
                type="text"
                placeholder={currency === "ARS" ? "$ 0" : "US$ 0"}
                {...register("cashPrice")}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setValue("cashPrice", formatCurrencyInput(raw, currency));
                }}
              />
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
              <select {...register("ownerType")} className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="own">Propio</option>
                <option value="consignment">Consignación</option>
              </select>
            </FormField>
            <FormField label="Estado">
              <select {...register("status")} className="w-full rounded-md border border-mist bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="disponible">Disponible</option>
                <option value="reservado">Reservado</option>
                <option value="en_preparacion">En preparación</option>
                <option value="vendido">Vendido</option>
              </select>
            </FormField>
            <FormField label="Margen ($)">
              <Input
                type="text"
                placeholder="0"
                {...register("margin")}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setValue("margin", formatNumericInput(raw));
                }}
              />
            </FormField>
            <FormField label="Gastos ($)">
              <Input
                type="text"
                placeholder="0"
                {...register("expenses")}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setValue("expenses", formatNumericInput(raw));
                }}
              />
            </FormField>
          </CardContent>
        </Card>

        {/* Equipamiento */}
        <Card className="border-slate-200 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-slate2 uppercase tracking-wide">Equipamiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }}
                placeholder="Ej: Techo solar, Apple CarPlay, 4x4…"
              />
              <button
                type="button"
                onClick={addFeature}
                className="flex items-center gap-1 rounded-lg border border-mist bg-white px-3 py-2 text-sm text-navy hover:bg-paper transition-colors"
              >
                <Plus size={16} /> Agregar
              </button>
            </div>
            {features.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {features.map((f, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 rounded-full bg-paper border border-mist px-3 py-1 text-xs font-medium text-navy"
                  >
                    {f}
                    <button type="button" onClick={() => removeFeature(i)} className="text-slate2 hover:text-red-500 transition-colors">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
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
          </>
        )}

        {activeTab === "fotos" && (
          <Card className="border-slate-200 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-slate2 uppercase tracking-wide">
                Fotos del vehículo
                {photos.length > 0 && (
                  <span className="ml-2 font-normal normal-case text-slate2/60">
                    {photos.length} foto{photos.length > 1 ? "s" : ""} · la primera es la portada
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhotos}
                  className="flex items-center gap-2 rounded-lg border-2 border-dashed border-mist px-5 py-4 text-sm text-slate2 hover:border-brand hover:text-brand transition-colors disabled:opacity-50 w-full justify-center"
                >
                  <Upload size={18} />
                  {uploadingPhotos ? "Subiendo fotos…" : "Seleccioná fotos (máx. 5MB c/u)"}
                </button>
              </div>

              {photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  {photos.map((url, index) => (
                    <div key={url} className="relative group aspect-square">
                      <img
                        src={url}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg border border-mist"
                      />
                      {index === 0 && (
                        <span className="absolute top-1 left-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Portada
                        </span>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => movePhoto(index, index - 1)}
                            className="rounded bg-white/90 p-1 text-navy hover:bg-white"
                            title="Mover a la izquierda"
                          >
                            <GripVertical size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="rounded bg-white/90 p-1 text-red-600 hover:bg-white"
                          title="Eliminar foto"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {photos.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-slate2/60">
                  <ImageIcon size={32} />
                  <p className="text-xs">Sin fotos aún. La primera que subas será la portada.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isEdit && activeTab === "documentacion" && (
          <Card className="border-slate-200 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-slate2 uppercase tracking-wide">
                Documentación del vehículo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VehicleDocumentsPanel documents={documents} onChange={setDocuments} />
            </CardContent>
          </Card>
        )}

        {activeTab === "notas" && (
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
        )}

        {activeTab !== "qr" && (
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || uploadingPhotos}
            className="bg-brand hover:bg-brand-600 text-white gap-2"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Guardar vehículo"}
          </Button>
        </div>
        )}
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
