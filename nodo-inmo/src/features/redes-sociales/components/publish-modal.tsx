import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { Button } from "@nodocore/shared-components";
import { Loader2 } from "lucide-react";
import type { PropertyRow } from "@/features/properties/hooks/use-properties";
import { usePropertyPhotos } from "@/features/properties/hooks/use-property-photos";
import { usePublishToMeta } from "../hooks/use-publish-to-meta";
import { useAuth } from "@nodocore/shared-components";

interface PublishModalProps {
  property: PropertyRow;
  network: "instagram" | "facebook";
  onClose: () => void;
}

function buildDefaultCaption(property: PropertyRow): string {
  const parts: string[] = [];

  if (property.address) parts.push(property.address);

  const rooms = property.rooms ? `${property.rooms} ambientes` : null;
  if (rooms) parts.push(rooms);

  const priceValue = property.sale_price ?? (property as PropertyRow & { rent_price?: number | null }).rent_price;
  if (priceValue) {
    parts.push(`${property.currency} ${priceValue.toLocaleString("es-AR")}`);
  }

  let caption = parts.join(" | ");

  if (property.description) {
    caption += `\n\n${property.description}`;
  }

  return caption;
}

export function PublishModal({ property, network, onClose }: PublishModalProps) {
  const { orgId } = useAuth();
  const mainPhotoPath = property.main_photo ? [property.main_photo] : [];
  const { data: photos } = usePropertyPhotos(mainPhotoPath);
  const photoUrl = photos?.[0]?.url;

  const [caption, setCaption] = useState(() => buildDefaultCaption(property));
  const [success, setSuccess] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const mutation = usePublishToMeta();

  const networkLabel = network === "instagram" ? "Instagram" : "Facebook";

  async function handlePublish() {
    if (!orgId) return;
    setPublishError(null);
    setSuccess(false);

    try {
      const result = await mutation.mutateAsync({
        network,
        property_id: property.id,
        caption,
        org_id: orgId,
      });

      if (!result.success) {
        setPublishError(result.error ?? "Error al publicar");
        return;
      }

      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Error al publicar");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publicar en {networkLabel}</DialogTitle>
          <DialogDescription>
            {property.address}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={property.address}
              className="w-full h-48 object-cover rounded-md border border-border"
            />
          ) : (
            <div className="w-full h-48 rounded-md border border-border bg-muted flex items-center justify-center">
              <span className="text-sm text-slate2">Sin foto principal</span>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="publish-caption" className="text-sm font-medium text-navy">
              Caption
            </label>
            <textarea
              id="publish-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {success && (
            <p className="text-sm text-green-600 font-medium">
              ¡Publicado en {networkLabel}!
            </p>
          )}

          {publishError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
              <p className="text-sm text-destructive">{publishError}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handlePublish} disabled={mutation.isPending || success}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publicando...
              </>
            ) : (
              `Publicar en ${networkLabel}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
