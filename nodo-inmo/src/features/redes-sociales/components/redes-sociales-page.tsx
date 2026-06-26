import { useState } from "react";
import { CheckCircle2, X, Settings } from "lucide-react";
import { Button } from "@nodocore/shared-components";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useProperties } from "@/features/properties/hooks/use-properties";
import { usePropertyPhotos } from "@/features/properties/hooks/use-property-photos";
import type { PropertyRow } from "@/features/properties/hooks/use-properties";
import { useMetaSettings } from "../hooks/use-meta-settings";
import { PublishModal } from "./publish-modal";
import { MetaSettingsForm } from "./meta-settings-form";

// ── Thumbnail component (fetches signed URL per row) ─────────────────────────

function PropertyThumbnail({ path }: { path: string | null }) {
  const paths = path ? [path] : [];
  const { data: photos } = usePropertyPhotos(paths);
  const url = photos?.[0]?.url;

  if (!url) {
    return (
      <div className="w-12 h-12 rounded bg-muted border border-border flex items-center justify-center">
        <span className="text-[10px] text-slate2">Sin foto</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Foto de propiedad"
      className="w-12 h-12 object-cover rounded border border-border"
    />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function RedesSocialesPage() {
  const { data: properties, isLoading } = useProperties();
  const metaSettings = useMetaSettings();
  const hasCredentials = !!metaSettings;

  const [publishTarget, setPublishTarget] = useState<{
    property: PropertyRow;
    network: "instagram" | "facebook";
  } | null>(null);
  const [credentialsOpen, setCredentialsOpen] = useState(false);

  function handlePublishClick(property: PropertyRow, network: "instagram" | "facebook") {
    if (!hasCredentials) {
      setCredentialsOpen(true);
      return;
    }
    setPublishTarget({ property, network });
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy">Redes Sociales</h2>
          <p className="text-sm text-slate2">
            Publicá propiedades en Instagram y Facebook directamente desde el panel.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCredentialsOpen(true)}
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" />
          Configurar credenciales
        </Button>
      </div>

      {!hasCredentials && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            Configurá tus credenciales de Meta en Configuración para publicar propiedades.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-slate2">Cargando propiedades...</span>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-paper border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-navy w-16">Foto</th>
                <th className="text-left px-4 py-3 font-semibold text-navy">Dirección</th>
                <th className="text-center px-4 py-3 font-semibold text-navy w-28">Instagram</th>
                <th className="text-center px-4 py-3 font-semibold text-navy w-28">Facebook</th>
              </tr>
            </thead>
            <tbody>
              {(properties ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-slate2">
                    No hay propiedades para mostrar.
                  </td>
                </tr>
              ) : (
                (properties ?? []).map((property) => (
                  <tr
                    key={property.id}
                    className="border-b border-border last:border-0 hover:bg-paper/60 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <PropertyThumbnail path={property.main_photo} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-navy">{property.address}</span>
                      {property.localidad && (
                        <span className="block text-xs text-slate2">{property.localidad}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {property.instagram_post_id ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePublishClick(property, "instagram")}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-destructive/10 hover:bg-destructive/20 transition-colors mx-auto"
                          title="Publicar en Instagram"
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {property.facebook_post_id ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePublishClick(property, "facebook")}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-destructive/10 hover:bg-destructive/20 transition-colors mx-auto"
                          title="Publicar en Facebook"
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Publish modal */}
      {publishTarget && (
        <PublishModal
          property={publishTarget.property}
          network={publishTarget.network}
          onClose={() => setPublishTarget(null)}
        />
      )}

      {/* Credentials dialog (inline, outside SettingsDialog) */}
      <Dialog open={credentialsOpen} onOpenChange={setCredentialsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Credenciales de Meta</DialogTitle>
          </DialogHeader>
          <MetaSettingsForm />
        </DialogContent>
      </Dialog>
    </div>
  );
}
