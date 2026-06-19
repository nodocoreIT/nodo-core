import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Save, X, Plus, Loader2 } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormSelect,
} from "@nodocore/shared-components";
import { VehicleTabBar, type VehicleTab } from "@/features/vehicles/components/vehicle-tab-bar";
import { VehicleQrPanel } from "@/features/vehicles/components/vehicle-qr-panel";
import { VehicleDocumentsPanel } from "@/features/vehicles/components/vehicle-documents-panel";
import { VehiclePhotosPanel } from "@/features/vehicles/components/vehicle-photos-panel";
import type { VehicleDocument } from "@/types";
import { useVehicleStore } from "@/store/vehicle-store";
import { supabase } from "@/shared/lib/supabase";
import {
  normalizeCurrency,
  normalizeDoors,
  normalizeFuelType,
  normalizeOwnerType,
  normalizeTransmission,
  normalizeVehicleCondition,
  normalizeVehicleStatus,
  resolveFormSelectValue,
} from "@/features/vehicles/lib/vehicle-field-normalizers";
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
  fuelType: z.preprocess(
    (value) => normalizeFuelType(typeof value === "string" ? value : ""),
    z.enum(["Diésel", "Eléctrico", "Nafta", "Nafta/GNC", "GNC", "Híbrido"]),
  ),
  transmission: z.preprocess(
    (value) =>
      value === "" || value === undefined || value === null
        ? undefined
        : normalizeTransmission(String(value)),
    z.enum(["manual", "automatica"]).optional(),
  ),
  doors: z.preprocess(
    (value) => normalizeDoors(value as number | string | undefined | null),
    z.union([z.literal(3), z.literal(4), z.literal(5)]).optional(),
  ),
  kilometers: z.string().min(1, "Kilómetros requeridos"),
  condition: z.preprocess(
    (value) => normalizeVehicleCondition(typeof value === "string" ? value : ""),
    z.enum(["nuevo", "usado"]),
  ),
  status: z.preprocess(
    (value) => normalizeVehicleStatus(typeof value === "string" ? value : ""),
    z.enum(["disponible", "reservado", "vendido", "en_preparacion"]),
  ),
  currency: z.preprocess(
    (value) => normalizeCurrency(typeof value === "string" ? value : ""),
    z.enum(["ARS", "USD"]),
  ),
  listPrice: z.string().min(1, "Precio de lista requerido"),
  cashPrice: z.string().optional(),
  showPrice: z.boolean(),
  entryDate: z.string().min(1, "Fecha de ingreso requerida"),
  ownerType: z.preprocess(
    (value) => normalizeOwnerType(typeof value === "string" ? value : ""),
    z.enum(["own", "consignment"]),
  ),
  margin: z.string().optional(),
  expenses: z.string().optional(),
  description: z.string(),
  internalNotes: z.string().optional(),
  licensePlate: z.string().optional(),
  vin: z.string().optional(),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

const FUEL_TYPE_OPTIONS = [
  { value: "Nafta", label: "Nafta" },
  { value: "Diésel", label: "Diésel" },
  { value: "Nafta/GNC", label: "Nafta/GNC" },
  { value: "GNC", label: "GNC" },
  { value: "Híbrido", label: "Híbrido" },
  { value: "Eléctrico", label: "Eléctrico" },
];

const TRANSMISSION_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "automatica", label: "Automática" },
];

const DOORS_OPTIONS = [
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
];

const CONDITION_OPTIONS = [
  { value: "usado", label: "Usado" },
  { value: "nuevo", label: "Nuevo" },
];

const CURRENCY_OPTIONS = [
  { value: "ARS", label: "ARS — Pesos" },
  { value: "USD", label: "USD — Dólares" },
];

const OWNER_TYPE_OPTIONS = [
  { value: "own", label: "Propio" },
  { value: "consignment", label: "Consignación" },
];

const STATUS_OPTIONS = [
  { value: "disponible", label: "Disponible" },
  { value: "reservado", label: "Reservado" },
  { value: "en_preparacion", label: "En preparación" },
  { value: "vendido", label: "Vendido" },
];

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
  const [photoUploadProgress, setPhotoUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Features/equipment state ───────────────────────────────────────────────
  const [features, setFeatures] = useState<string[]>(existing?.features ?? []);
  const [featureInput, setFeatureInput] = useState("");
  const [documents, setDocuments] = useState<VehicleDocument[]>(existing?.documents ?? []);
  const [activeTab, setActiveTab] = useState<VehicleTab>("datos");

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema) as import("react-hook-form").Resolver<VehicleFormValues>,
    shouldUnregister: false,
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
        fuelType: normalizeFuelType(existing.fuelType),
        transmission: normalizeTransmission(existing.transmission),
        doors: normalizeDoors(existing.doors),
        kilometers: formatNumericInput(existing.kilometers),
        condition: normalizeVehicleCondition(existing.condition),
        status: normalizeVehicleStatus(existing.status),
        currency: normalizeCurrency(existing.currency),
        listPrice: formatCurrencyInput(existing.listPrice, existing.currency),
        cashPrice: existing.cashPrice !== undefined && existing.cashPrice !== null ? formatCurrencyInput(existing.cashPrice, existing.currency) : "",
        showPrice: existing.showPrice,
        entryDate: existing.entryDate,
        ownerType: normalizeOwnerType(existing.ownerType),
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
    setPhotoUploadProgress({ current: 0, total: files.length });
    const uploaded: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        setPhotoUploadProgress({ current: i + 1, total: files.length });
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
      setPhotoUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
  function onInvalid(formErrors: FieldErrors<VehicleFormValues>) {
    const firstMessage = Object.values(formErrors).find(
      (error) => error?.message,
    )?.message;

    toast.error(firstMessage ?? "Revisá los datos en la pestaña Datos");
    if (activeTab !== "datos") setActiveTab("datos");
  }

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

    const toastId = toast.loading(
      isEdit ? "Guardando cambios…" : "Creando vehículo…",
    );

    try {
      if (isEdit && id) {
        await updateVehicle(id, payload);
        toast.success("Cambios guardados", {
          id: toastId,
          description: "El vehículo se actualizó correctamente",
          duration: 4000,
        });
      } else {
        await addVehicle(payload);
        toast.success("Vehículo creado", {
          id: toastId,
          description: "Ya está en tu stock",
          duration: 4000,
        });
        navigate("/admin/vehiculos");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo guardar el vehículo";
      toast.error(message, { id: toastId });
    }
  }

  return (
    <div className="space-y-6 w-full max-w-6xl">
      {isSubmitting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] px-4"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white px-8 py-6 shadow-xl text-center">
            <Loader2 className="h-10 w-10 text-brand animate-spin" />
            <p className="text-sm font-semibold text-navy">
              {isEdit ? "Guardando cambios…" : "Creando vehículo…"}
            </p>
            <p className="text-xs text-slate2">Un momento</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-slate2 hover:text-navy transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

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

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-5">
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
              <Controller
                name="fuelType"
                control={control}
                render={({ field }) => (
                  <FormSelect
                    value={resolveFormSelectValue(field.value, FUEL_TYPE_OPTIONS)}
                    onChange={(value) => field.onChange(normalizeFuelType(value))}
                    options={FUEL_TYPE_OPTIONS}
                  />
                )}
              />
            </FormField>
            <FormField label="Transmisión">
              <Controller
                name="transmission"
                control={control}
                render={({ field }) => (
                  <FormSelect
                    value={resolveFormSelectValue(
                      field.value ?? "",
                      TRANSMISSION_OPTIONS,
                      true,
                    )}
                    onChange={(value) => field.onChange(normalizeTransmission(value))}
                    options={TRANSMISSION_OPTIONS}
                    allowEmpty
                    emptyLabel="Sin especificar"
                  />
                )}
              />
            </FormField>
            <FormField label="Puertas">
              <Controller
                name="doors"
                control={control}
                render={({ field }) => (
                  <FormSelect
                    value={resolveFormSelectValue(
                      field.value ? String(field.value) : "",
                      DOORS_OPTIONS,
                      true,
                    )}
                    onChange={(value) => field.onChange(normalizeDoors(value))}
                    options={DOORS_OPTIONS}
                    allowEmpty
                    emptyLabel="Sin especificar"
                  />
                )}
              />
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
              <Controller
                name="condition"
                control={control}
                render={({ field }) => (
                  <FormSelect
                    value={resolveFormSelectValue(field.value, CONDITION_OPTIONS)}
                    onChange={(value) =>
                      field.onChange(normalizeVehicleCondition(value))
                    }
                    options={CONDITION_OPTIONS}
                  />
                )}
              />
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
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <FormSelect
                    value={resolveFormSelectValue(field.value, CURRENCY_OPTIONS)}
                    onChange={(value) => field.onChange(normalizeCurrency(value))}
                    options={CURRENCY_OPTIONS}
                  />
                )}
              />
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
              <Controller
                name="ownerType"
                control={control}
                render={({ field }) => (
                  <FormSelect
                    value={resolveFormSelectValue(field.value, OWNER_TYPE_OPTIONS)}
                    onChange={(value) => field.onChange(normalizeOwnerType(value))}
                    options={OWNER_TYPE_OPTIONS}
                  />
                )}
              />
            </FormField>
            <FormField label="Estado">
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <FormSelect
                    value={resolveFormSelectValue(field.value, STATUS_OPTIONS)}
                    onChange={(value) => field.onChange(normalizeVehicleStatus(value))}
                    options={STATUS_OPTIONS}
                  />
                )}
              />
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
            <CardContent>
              <VehiclePhotosPanel
                photos={photos}
                uploadingPhotos={uploadingPhotos}
                uploadProgress={photoUploadProgress}
                fileInputRef={fileInputRef}
                onFileSelect={handleFileSelect}
                onPhotosChange={setPhotos}
              />
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
