import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Printer, Globe, GlobeLock } from "lucide-react";
import { Button } from "@nodocore/shared-components";
import { toast } from "sonner";
import type { Vehicle } from "@/types";
import { useVehicleStore } from "@/store/vehicle-store";
import {
  buildPublicVehicleUrl,
  copyToClipboard,
  generateQRCode,
  generateQRPDF,
} from "@/utils/vehicle-helpers";

interface VehicleQrPanelProps {
  vehicle: Vehicle;
  clienteIdentificador?: string;
}

export function VehicleQrPanel({ vehicle, clienteIdentificador }: VehicleQrPanelProps) {
  const { updateVehicle } = useVehicleStore();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const publicUrl = buildPublicVehicleUrl(vehicle.publicSlug, clienteIdentificador);

  useEffect(() => {
    generateQRCode(publicUrl).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [publicUrl]);

  async function handleCopy() {
    const ok = await copyToClipboard(publicUrl);
    if (ok) {
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handlePrint() {
    try {
      await generateQRPDF(vehicle, clienteIdentificador);
    } catch {
      toast.error("Error al generar el PDF del QR");
    }
  }

  async function handleTogglePublished() {
    setPublishing(true);
    try {
      await updateVehicle(vehicle.id, { isPublished: !vehicle.isPublished });
      toast.success(
        vehicle.isPublished
          ? "El enlace ya no es público"
          : "Vehículo publicado — el enlace ya funciona para cualquiera",
      );
    } catch {
      toast.error("No se pudo actualizar la publicación");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="w-full max-w-lg rounded-xl border border-mist bg-paper p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-navy">Página pública</p>
            <p className="mt-1 text-xs text-slate2 leading-relaxed">
              Cualquier persona con el enlace o el QR puede ver este vehículo sin iniciar sesión.
            </p>
          </div>
          <Button
            type="button"
            variant={vehicle.isPublished ? "default" : "outline"}
            size="sm"
            disabled={publishing}
            onClick={() => void handleTogglePublished()}
            className={
              vehicle.isPublished
                ? "shrink-0 gap-1.5 bg-brand hover:bg-brand-600 text-white"
                : "shrink-0 gap-1.5"
            }
          >
            {vehicle.isPublished ? (
              <Globe className="h-4 w-4" />
            ) : (
              <GlobeLock className="h-4 w-4" />
            )}
            {vehicle.isPublished ? "Publicado" : "Publicar"}
          </Button>
        </div>
        {!vehicle.isPublished ? (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            El enlace y el QR existen, pero solo funcionan cuando activás <strong>Publicar</strong>.
          </p>
        ) : null}
      </div>

      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt="Código QR del vehículo"
          className="h-56 w-56 rounded-xl border border-mist shadow-sm bg-white p-3"
        />
      ) : (
        <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-dashed border-mist text-sm text-slate2">
          Generando QR…
        </div>
      )}

      <p className="max-w-md break-all text-center text-sm text-slate2">{publicUrl}</p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="outline" className="gap-2" onClick={handlePrint}>
          <Printer className="h-4 w-4" />
          Imprimir QR (A4)
        </Button>
        <Button type="button" variant="outline" className="gap-2" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          Copiar enlace
        </Button>
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-mist bg-white px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-paper"
        >
          <ExternalLink className="h-4 w-4" />
          Ver página pública
        </a>
      </div>
    </div>
  );
}
