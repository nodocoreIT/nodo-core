import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Printer } from "lucide-react";
import { Button } from "@nodocore/shared-components";
import { toast } from "sonner";
import type { Vehicle } from "@/types";
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
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
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

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {qrDataUrl ? (
        <img src={qrDataUrl} alt="Código QR del vehículo" className="h-56 w-56 rounded-xl border border-mist shadow-sm bg-white p-3" />
      ) : (
        <div className="h-56 w-56 rounded-xl border border-dashed border-mist flex items-center justify-center text-sm text-slate2">
          Generando QR…
        </div>
      )}
      <p className="text-sm text-slate2 text-center max-w-md break-all">{publicUrl}</p>
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
          className="inline-flex items-center gap-2 rounded-md border border-mist bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-paper transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Ver página pública
        </a>
      </div>
    </div>
  );
}
