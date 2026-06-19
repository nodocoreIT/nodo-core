import * as XLSX from "xlsx";
import { parseDigitsToNumber } from "@/utils/contract-calculations";
import type { FuelType, VehicleCondition, VehicleStatus, Currency } from "@/types";

export const IMPORT_REQUIRED_FIELDS = [
  { key: "brand", label: "Marca", header: "marca" },
  { key: "model", label: "Modelo", header: "modelo" },
  { key: "year", label: "Año", header: "ano" },
  { key: "fuel_type", label: "Combustible", header: "combustible" },
  { key: "status", label: "Estado", header: "estado" },
  { key: "currency", label: "Moneda", header: "moneda" },
  { key: "list_price", label: "Precio de lista", header: "precio_lista" },
  { key: "entry_date", label: "Fecha de ingreso", header: "fecha_ingreso" },
] as const;

export const IMPORT_OPTIONAL_FIELDS = [
  { key: "version", label: "Versión", header: "version" },
  { key: "license_plate", label: "Patente", header: "patente" },
  { key: "kilometers", label: "Kilómetros", header: "kilometros" },
  { key: "cash_price", label: "Precio contado", header: "precio_contado" },
  { key: "price_observations", label: "Observaciones de precio", header: "observaciones_precio" },
  { key: "margin", label: "Margen", header: "margen" },
  { key: "expenses", label: "Gastos", header: "gastos" },
  { key: "description", label: "Descripción", header: "descripcion" },
  { key: "features", label: "Características", header: "caracteristicas" },
  { key: "photos", label: "Fotos", header: "fotos" },
  { key: "is_published", label: "Publicar", header: "publicado" },
  { key: "internal_notes", label: "Notas internas", header: "notas_internas" },
  { key: "tags", label: "Tags", header: "tags" },
  { key: "condition", label: "Condición", header: "condicion" },
  { key: "owner_type", label: "Tenencia", header: "dueno_consignacion" },
  { key: "vin", label: "VIN", header: "vin" },
] as const;

export type ImportVehicleRow = {
  id: string;
  brand: string;
  model: string;
  year: string;
  status: string;
  fuel_type: string;
  condition: string;
  currency: string;
  list_price: string;
  entry_date: string;
  owner_type: string;
  version: string;
  license_plate: string;
  vin: string;
  kilometers: string;
  cash_price: string;
  price_observations: string;
  margin: string;
  expenses: string;
  description: string;
  features: string;
  photos: string;
  is_published: string;
  internal_notes: string;
  tags: string;
};

const normalizeValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

export function mapImportValue(key: string, value: string): string {
  const normalized = normalizeValue(value);

  if (key === "fuel_type") {
    if (["diesel", "gasoil"].includes(normalized)) return "Diésel";
    if (["electrico", "electrica"].includes(normalized)) return "Eléctrico";
    if (["nafta", "gasolina"].includes(normalized)) return "Nafta";
    if (["naftagnc", "nafta/gnc", "nafta-gnc"].includes(normalized)) return "Nafta/GNC";
    if (normalized === "gnc") return "GNC";
    if (["hibrido", "hibrida", "hybrid"].includes(normalized)) return "Híbrido";
  }

  if (key === "condition") {
    if (["nuevo", "0km"].includes(normalized)) return "nuevo";
    if (["usado", "usada"].includes(normalized)) return "usado";
  }

  if (key === "status") {
    if (normalized === "disponible") return "disponible";
    if (["reservado", "reservada"].includes(normalized)) return "reservado";
    if (["vendido", "vendida"].includes(normalized)) return "vendido";
    if (["enpreparacion", "preparacion"].includes(normalized)) return "en_preparacion";
  }

  if (key === "currency") {
    if (["ars", "$", "pesos"].includes(normalized)) return "ARS";
    if (["usd", "us$", "dolares", "dolar"].includes(normalized)) return "USD";
  }

  if (key === "owner_type") {
    if (["own", "propio"].includes(normalized)) return "own";
    if (["consignment", "consignacion"].includes(normalized)) return "consignment";
  }

  if (key === "is_published") {
    if (["true", "si", "s", "1", "verdadero"].includes(normalized)) return "true";
    if (["false", "no", "n", "0", "falso"].includes(normalized)) return "false";
  }

  return value.trim();
}

const normalizeHeader = (value: string) =>
  value
    .trim()
    .replace(/^\*+\s*/g, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\*/g, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");

const headerMap: Record<string, string> = {
  marca: "brand",
  modelo: "model",
  ano: "year",
  anio: "year",
  year: "year",
  combustible: "fuel_type",
  condicion: "condition",
  estado: "status",
  moneda: "currency",
  precio_lista: "list_price",
  list_price: "list_price",
  fecha_ingreso: "entry_date",
  entry_date: "entry_date",
  dueno_consignacion: "owner_type",
  owner_type: "owner_type",
  version: "version",
  patente: "license_plate",
  license_plate: "license_plate",
  vin: "vin",
  kilometros: "kilometers",
  kilometers: "kilometers",
  precio_contado: "cash_price",
  cash_price: "cash_price",
  observaciones_precio: "price_observations",
  price_observations: "price_observations",
  margen: "margin",
  margin: "margin",
  gastos: "expenses",
  expenses: "expenses",
  descripcion: "description",
  description: "description",
  caracteristicas: "features",
  features: "features",
  fotos: "photos",
  photos: "photos",
  publicado: "is_published",
  is_published: "is_published",
  notas_internas: "internal_notes",
  internal_notes: "internal_notes",
  tags: "tags",
};

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value).trim();
}

export function splitImportPhotos(value: string): string[] {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const normalized = item.toLowerCase();
      return !["null", "undefined", "-", "n/a"].includes(normalized);
    });
}

export function splitPipeValues(value: string): string[] {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toOptionalNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  return parseDigitsToNumber(value);
}

export function parseVehicleImportWorkbook(data: ArrayBuffer): {
  errors: string[];
  rows: ImportVehicleRow[];
} {
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { errors: ["El archivo no contiene hojas."], rows: [] };

  const worksheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  if (raw.length === 0) return { errors: ["El archivo no contiene datos."], rows: [] };

  const [headerRow, ...bodyRows] = raw;
  const headers = (headerRow ?? []).map((value) => normalizeHeader(formatCellValue(value)));
  const mappedHeaders = headers.map((header) => headerMap[header] ?? header);
  const requiredKeys = IMPORT_REQUIRED_FIELDS.map((field) => field.key);
  const errors: string[] = [];

  IMPORT_REQUIRED_FIELDS.forEach((field) => {
    if (!mappedHeaders.includes(field.key)) {
      errors.push(`Falta la columna requerida: ${field.header}`);
    }
  });

  if (errors.length > 0) return { errors, rows: [] };

  const indexByKey = new Map<string, number>();
  mappedHeaders.forEach((key, index) => {
    if (!indexByKey.has(key)) indexByKey.set(key, index);
  });

  const rows: ImportVehicleRow[] = [];

  bodyRows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const cells = row ?? [];
    const isEmpty = cells.every((cell) => formatCellValue(cell) === "");
    if (isEmpty) return;

    const missingKeys = requiredKeys.filter((key) => {
      const index = indexByKey.get(key);
      const value = index === undefined ? "" : formatCellValue(cells[index]);
      return value === "";
    });

    if (missingKeys.length > 0) {
      errors.push(`Fila ${rowNumber}: faltan valores en ${missingKeys.join(", ")}`);
      return;
    }

    const getValue = (key: string) => {
      const index = indexByKey.get(key);
      return index === undefined ? "" : formatCellValue(cells[index]);
    };

    rows.push({
      id: `${getValue("brand")}-${getValue("model")}-${rowNumber}`,
      brand: getValue("brand"),
      model: getValue("model"),
      year: getValue("year"),
      status: mapImportValue("status", getValue("status")),
      fuel_type: mapImportValue("fuel_type", getValue("fuel_type")),
      condition: mapImportValue("condition", getValue("condition") || "usado"),
      currency: mapImportValue("currency", getValue("currency")),
      list_price: getValue("list_price"),
      entry_date: getValue("entry_date"),
      owner_type: mapImportValue("owner_type", getValue("owner_type") || "own"),
      version: getValue("version"),
      license_plate: getValue("license_plate"),
      vin: getValue("vin"),
      kilometers: getValue("kilometers"),
      cash_price: getValue("cash_price"),
      price_observations: getValue("price_observations"),
      margin: getValue("margin"),
      expenses: getValue("expenses"),
      description: getValue("description"),
      features: getValue("features"),
      photos: getValue("photos"),
      is_published: mapImportValue("is_published", getValue("is_published") || "false"),
      internal_notes: getValue("internal_notes"),
      tags: getValue("tags"),
    });
  });

  if (errors.length > 0) return { errors, rows: [] };
  if (rows.length === 0) return { errors: ["No se encontraron vehículos en el archivo."], rows: [] };

  return { errors: [], rows };
}

export function importRowToVehiclePayload(
  row: ImportVehicleRow,
  clienteId: string,
  publicSlug: string,
) {
  const licensePlate = row.license_plate.trim().toUpperCase();

  return {
    clienteId,
    brand: row.brand.trim(),
    model: row.model.trim(),
    version: row.version.trim() || undefined,
    year: parseDigitsToNumber(row.year),
    licensePlate: licensePlate || undefined,
    vin: row.vin.trim() || undefined,
    fuelType: mapImportValue("fuel_type", row.fuel_type || "Nafta") as FuelType,
    kilometers: parseDigitsToNumber(row.kilometers || "0"),
    condition: mapImportValue("condition", row.condition || "usado") as VehicleCondition,
    status: mapImportValue("status", row.status || "disponible") as VehicleStatus,
    currency: mapImportValue("currency", row.currency || "ARS") as Currency,
    listPrice: parseDigitsToNumber(row.list_price),
    cashPrice: toOptionalNumber(row.cash_price),
    showPrice: true,
    priceObservations: row.price_observations.trim() || undefined,
    entryDate: row.entry_date.trim() || new Date().toISOString().split("T")[0],
    ownerType: mapImportValue("owner_type", row.owner_type || "own") as "own" | "consignment",
    margin: toOptionalNumber(row.margin),
    expenses: toOptionalNumber(row.expenses),
    description: row.description.trim() || "",
    features: splitPipeValues(row.features),
    photos: splitImportPhotos(row.photos),
    documents: [],
    isPublished: mapImportValue("is_published", row.is_published || "false") === "true",
    publicSlug,
    internalNotes: row.internal_notes.trim() || undefined,
    tags: splitPipeValues(row.tags),
  };
}

export const IMPORT_STATUS_LABELS: Record<string, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  vendido: "Vendido",
  en_preparacion: "En preparación",
};
