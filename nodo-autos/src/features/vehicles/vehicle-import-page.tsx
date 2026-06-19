import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Download, Upload, X, Trash2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nodocore/shared-components";
import { useVehicleStore } from "@/store/vehicle-store";
import { formatPrice } from "@/shared/lib/utils";
import {
  IMPORT_OPTIONAL_FIELDS,
  IMPORT_REQUIRED_FIELDS,
  IMPORT_STATUS_LABELS,
  parseVehicleImportWorkbook,
  splitImportPhotos,
  type ImportVehicleRow,
} from "@/features/vehicles/lib/vehicle-import";
import { parseDigitsToNumber } from "@/utils/contract-calculations";

export function VehicleImportPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importVehicles, loadInitialData } = useVehicleStore();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [previewVehicles, setPreviewVehicles] = useState<ImportVehicleRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccessCount, setImportSuccessCount] = useState(0);

  function handleClearFile() {
    setSelectedFile(null);
    setFileError(null);
    setParseErrors([]);
    setPreviewVehicles([]);
    setImportErrors([]);
    setImportSuccessCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    handleClearFile();

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setFileError("Solo se acepta formato .xlsx");
      return;
    }

    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result;
      if (!(buffer instanceof ArrayBuffer)) {
        setFileError("No se pudo leer el archivo.");
        setIsParsing(false);
        return;
      }

      const { errors, rows } = parseVehicleImportWorkbook(buffer);
      if (errors.length > 0) {
        setParseErrors(errors);
        setIsParsing(false);
        return;
      }

      setSelectedFile(file);
      setPreviewVehicles(rows);
      setIsParsing(false);
    };
    reader.onerror = () => {
      setFileError("No se pudo leer el archivo.");
      setIsParsing(false);
    };
    reader.readAsArrayBuffer(file);
  }

  function handleRemoveVehicle(id: string) {
    setPreviewVehicles((prev) => prev.filter((vehicle) => vehicle.id !== id));
  }

  async function handleImport() {
    if (previewVehicles.length === 0) return;

    setIsImporting(true);
    setImportErrors([]);
    setImportSuccessCount(0);

    const { successCount, errors } = await importVehicles(previewVehicles);

    setImportSuccessCount(successCount);
    setImportErrors(errors);
    setIsImporting(false);

    if (successCount > 0) {
      toast.success(`${successCount} vehículo(s) importados correctamente`);
      await loadInitialData(true);
      if (errors.length === 0) {
        navigate("/admin/vehiculos");
      }
    } else {
      toast.error("No se importaron vehículos");
    }
  }

  const showGuide = previewVehicles.length === 0 && parseErrors.length === 0 && !selectedFile;

  return (
    <div className="space-y-6 max-w-6xl">
      {isImporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <Card className="w-full max-w-sm text-center shadow-lg">
            <CardContent className="py-8">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              <p className="font-medium text-navy">Importando vehículos…</p>
              <p className="mt-1 text-sm text-slate2">Esto puede tardar unos segundos</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Link
            to="/admin/vehiculos"
            className="inline-flex items-center gap-2 text-sm text-slate2 hover:text-navy transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a vehículos
          </Link>
          <div>
            <p className="text-sm text-slate2">
              Subí un archivo .xlsx con el template. Si la patente ya existe, se actualiza el vehículo.
            </p>
          </div>
        </div>

        <a
          href={`${import.meta.env.BASE_URL}templates/vehicle-import-template.xlsx`}
          download="template_nodo_autos.xlsx"
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
        >
          <Download className="h-4 w-4" />
          Descargar template Excel
        </a>
      </div>

      <Card className="border-slate-200 rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm text-slate2 uppercase tracking-wide">
            Archivo Excel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={isParsing}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {isParsing ? "Procesando…" : "Subir archivo .xlsx"}
          </Button>

          {selectedFile && (
            <div className="flex items-center gap-2 text-sm text-slate2">
              <FileSpreadsheet className="h-4 w-4 text-brand" />
              <span>{selectedFile.name}</span>
              <button
                type="button"
                onClick={handleClearFile}
                className="rounded-full p-1 text-slate2 hover:bg-mist hover:text-navy"
                aria-label="Quitar archivo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {fileError && <p className="text-sm text-red-600">{fileError}</p>}
        </CardContent>
      </Card>

      {showGuide && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="border-slate-200 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-navy">Campos requeridos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {IMPORT_REQUIRED_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{field.label}</span>
                  <span className="font-mono text-xs text-slate2">{field.header}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-navy">Campos opcionales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {IMPORT_OPTIONAL_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{field.label}</span>
                  <span className="font-mono text-xs text-slate2">{field.header}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {parseErrors.length > 0 && (
        <Card className="border-red-200 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-red-700">Errores de validación</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-red-600">
              {parseErrors.map((error, index) => (
                <li key={`${error}-${index}`}>{error}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {previewVehicles.length > 0 && parseErrors.length === 0 && (
        <Card className="border-slate-200 rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base text-navy">Vista previa</CardTitle>
              <p className="mt-1 text-sm text-slate2">
                {previewVehicles.length} vehículo(s) detectados
              </p>
            </div>
            <Button
              onClick={() => void handleImport()}
              disabled={previewVehicles.length === 0 || isImporting}
              className="bg-brand hover:bg-brand-600 text-white"
            >
              Importar listado
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {(importErrors.length > 0 || importSuccessCount > 0) && (
              <div className="rounded-lg border border-mist bg-paper p-3 text-sm">
                {importSuccessCount > 0 && (
                  <p className="text-navy font-medium">
                    {importSuccessCount} vehículo(s) importados correctamente.
                  </p>
                )}
                {importErrors.length > 0 && (
                  <ul className="mt-2 space-y-1 text-red-600">
                    {importErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {previewVehicles.map((vehicle) => {
                const photoCount = splitImportPhotos(vehicle.photos).length;
                const currency = vehicle.currency === "USD" ? "USD" : "ARS";
                const price = parseDigitsToNumber(vehicle.list_price);

                return (
                  <div
                    key={vehicle.id}
                    className="rounded-lg border border-mist bg-paper p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-navy">
                          {vehicle.brand} {vehicle.model}
                        </p>
                        <p className="text-xs text-slate2 mt-0.5">
                          {vehicle.year}
                          {vehicle.license_plate ? ` · ${vehicle.license_plate.toUpperCase()}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveVehicle(vehicle.id)}
                        className="rounded-md p-1.5 text-slate2 hover:text-red-600 hover:bg-red-50"
                        aria-label="Quitar de la lista"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-slate2">
                      <span>
                        {IMPORT_STATUS_LABELS[vehicle.status] ?? vehicle.status}
                      </span>
                      <span>·</span>
                      <span>{formatPrice(price, currency as "ARS" | "USD")}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate2">
                      <span>Fotos</span>
                      {photoCount > 0 ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-slate2/50" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {showGuide && (
        <Card className="border-slate-200 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-navy">Formato recomendado</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 text-sm text-slate2">
            <div>
              <p className="font-medium text-navy mb-2">Valores esperados</p>
              <ul className="space-y-1">
                <li>Combustible: Diésel, Eléctrico, Nafta, Nafta/GNC, GNC, Híbrido</li>
                <li>Condición: nuevo, usado</li>
                <li>Estado: disponible, reservado, vendido, en_preparacion</li>
                <li>Moneda: ARS o USD</li>
                <li>Tenencia: propio, consignación</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-navy mb-2">Tips</p>
              <ul className="space-y-1">
                <li>Fotos y características: separar con pipe (|)</li>
                <li>Fotos: URLs públicas en la columna fotos</li>
                <li>Patente repetida: actualiza el vehículo existente</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
