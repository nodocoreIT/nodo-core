import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Trash2,
  RotateCcw,
  Loader2,
  Share2,
  Car,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from "@nodocore/shared-components";
import { useVehicleStore } from "@/store/vehicle-store";
import {
  deletePublication,
  publishVehicle,
  republishVehicle,
  isSocialAutomationConfigured,
} from "@/utils/automation";
import {
  SOCIAL_PLATFORMS,
  PLATFORM_LABELS,
  PLATFORM_LOGOS,
  defaultVehicleTitle,
  generateTechnicalDescription,
  getPublicationForPlatform,
  isPlatformPublished,
  getDaysSincePublication,
  formatDaysText,
  getDaysColorClass,
  formatVehicleLabel,
} from "@/utils/publication-social";
import type { SocialPlatformKey } from "@/types";

export function PublicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    getVehicleById,
    loadInitialData,
    publications,
    updateVehicle,
    upsertPublicationForChannel,
  } = useVehicleStore();

  const vehicle = id ? getVehicleById(id) : undefined;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pendingTitle, setPendingTitle] = useState("");
  const [pendingDescription, setPendingDescription] = useState("");
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatformKey | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSavingContent, setIsSavingContent] = useState(false);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!vehicle) return;
    setTitle(vehicle.socialTitle || defaultVehicleTitle(vehicle));
    setDescription(vehicle.socialDescription || vehicle.description || "");
  }, [vehicle]);

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Car className="h-10 w-10 text-slate2-300" />
        <p className="text-slate2">No se encontró el vehículo seleccionado.</p>
        <Button variant="outline" asChild>
          <Link to="/admin/publicaciones">Volver a publicaciones</Link>
        </Button>
      </div>
    );
  }

  const handleOpenContent = () => {
    setPendingTitle(title);
    setPendingDescription(description);
    setIsContentModalOpen(true);
  };

  const handleSaveContent = async () => {
    const nextTitle = pendingTitle.trim() || defaultVehicleTitle(vehicle);
    const nextDescription = pendingDescription.trim();

    setIsSavingContent(true);
    try {
      await updateVehicle(vehicle.id, {
        socialTitle: nextTitle,
        socialDescription: nextDescription,
      });
      setTitle(nextTitle);
      setDescription(nextDescription);
      setIsContentModalOpen(false);
    } finally {
      setIsSavingContent(false);
    }
  };

  const handlePlatformClick = (platform: SocialPlatformKey) => {
    setSelectedPlatform(platform);
    setActionError(null);
    setActionSuccess(null);
    setIsActionModalOpen(true);
  };

  const handlePublishNow = async () => {
    if (!selectedPlatform) return;
    setIsLoading(true);
    setActionError(null);

    try {
      const finalTitle = title.trim() || defaultVehicleTitle(vehicle);
      const finalDescription = description.trim() || vehicle.description;
      const result = await publishVehicle(
        vehicle,
        selectedPlatform,
        finalDescription,
        finalTitle,
      );

      if (!result.success || !result.externalId) {
        throw new Error(result.error || "Error al publicar");
      }

      await upsertPublicationForChannel(vehicle.id, selectedPlatform, {
        status: "publicado",
        externalId: result.externalId,
        postText: finalDescription,
        lastPublishedAt: new Date().toISOString(),
        errorMessage: undefined,
      });

      setActionSuccess("¡Vehículo publicado con éxito!");
      setTimeout(() => {
        setIsActionModalOpen(false);
        setActionSuccess(null);
      }, 2000);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Error al publicar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePermanently = async () => {
    if (!selectedPlatform) return;
    const pub = getPublicationForPlatform(publications, vehicle.id, selectedPlatform);
    if (!pub?.externalId) {
      setActionError("No se encuentra el ID de publicación");
      return;
    }

    setIsLoading(true);
    setActionError(null);

    try {
      const result = await deletePublication(pub.externalId, selectedPlatform);
      if (!result.success) throw new Error(result.error || "Error al eliminar");

      await upsertPublicationForChannel(vehicle.id, selectedPlatform, {
        status: "borrador",
        externalId: null,
        lastPublishedAt: null,
        errorMessage: null,
      });

      setActionSuccess("Publicación eliminada exitosamente");
      setTimeout(() => {
        setIsActionModalOpen(false);
        setActionSuccess(null);
      }, 2000);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Error al eliminar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAndRepublish = async () => {
    if (!selectedPlatform) return;
    const pub = getPublicationForPlatform(publications, vehicle.id, selectedPlatform);
    if (!pub?.externalId) {
      setActionError("No se encuentra el ID de publicación");
      return;
    }

    setIsLoading(true);
    setActionError(null);

    try {
      const finalTitle = title.trim() || defaultVehicleTitle(vehicle);
      const finalDescription = description.trim() || vehicle.description;
      const result = await republishVehicle(
        vehicle,
        selectedPlatform,
        pub.externalId,
        finalDescription,
        finalTitle,
      );

      if (!result.success || !result.externalId) {
        throw new Error(result.error || "Error al republicar");
      }

      await upsertPublicationForChannel(vehicle.id, selectedPlatform, {
        status: "publicado",
        externalId: result.externalId,
        postText: finalDescription,
        lastPublishedAt: new Date().toISOString(),
        errorMessage: undefined,
      });

      setActionSuccess("Publicación republicada exitosamente");
      setTimeout(() => {
        setIsActionModalOpen(false);
        setActionSuccess(null);
      }, 2000);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Error al republicar");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPub = selectedPlatform
    ? getPublicationForPlatform(publications, vehicle.id, selectedPlatform)
    : undefined;
  const selectedPublished = isPlatformPublished(selectedPub);

  return (
    <div className="space-y-6">
      <Link
        to="/admin/publicaciones"
        className="inline-flex items-center text-sm text-slate2 hover:text-navy transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Volver a publicaciones
      </Link>

      <div>
        <h2 className="text-2xl font-bold text-navy">
          {vehicle.licensePlate || "Sin patente"}
        </h2>
        <p className="text-sm text-slate2 mt-1">{formatVehicleLabel(vehicle)}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <Card className="border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <CardContent className="p-4">
            {vehicle.photos[0] ? (
              <img
                src={vehicle.photos[0]}
                alt={vehicle.licensePlate || vehicle.model}
                className="w-full rounded-md object-cover aspect-[4/3]"
              />
            ) : (
              <div className="h-44 rounded-md border border-dashed border-mist bg-paper flex items-center justify-center">
                <Car className="h-8 w-8 text-slate2-300" />
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-navy mb-1">Título</label>
                <div className="rounded-md border border-mist bg-paper px-3 py-2 text-sm text-navy font-semibold">
                  {title}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy mb-1">Descripción</label>
                <div className="rounded-md border border-mist bg-paper px-3 py-2 text-sm text-slate2 whitespace-pre-wrap min-h-[80px]">
                  {description.trim() ? description : "Sin descripción cargada."}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline" onClick={handleOpenContent} className="w-full">
                  Editar contenido para redes
                </Button>
                {!description.trim() && vehicle.description && (
                  <button
                    type="button"
                    onClick={() =>
                      void updateVehicle(vehicle.id, {
                        socialDescription: vehicle.description,
                      }).then(() => setDescription(vehicle.description))
                    }
                    className="text-xs font-medium text-brand hover:text-brand-600 underline text-left"
                  >
                    Usar descripción original del vehículo
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 rounded-xl shadow-sm">
          <CardContent className="p-6">
            <div className="p-4 bg-paper rounded-lg border border-mist">
              <h3 className="text-sm font-semibold text-navy mb-1 flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Gestión de Redes Sociales
              </h3>
              <p className="text-xs text-slate2 mb-4">
                Elegí una plataforma para publicar, actualizar o eliminar la publicación.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SOCIAL_PLATFORMS.map((platform) => {
                  const pub = getPublicationForPlatform(publications, vehicle.id, platform);
                  const published = isPlatformPublished(pub);
                  const days = getDaysSincePublication(pub?.lastPublishedAt);
                  const configured = isSocialAutomationConfigured(platform);

                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => handlePlatformClick(platform)}
                      className="flex flex-col p-4 bg-white rounded-lg border border-mist hover:border-brand hover:shadow-md transition-all text-left"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <img
                          src={PLATFORM_LOGOS[platform]}
                          alt={PLATFORM_LABELS[platform]}
                          className="h-8 w-8 object-contain"
                        />
                        <div>
                          <div className="text-sm font-bold text-navy">
                            {PLATFORM_LABELS[platform]}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {published ? (
                              <>
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                                  Publicado
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="h-2 w-2 rounded-full bg-slate2-300" />
                                <span className="text-[10px] font-bold text-slate2 uppercase tracking-wider">
                                  Sin publicar
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {!configured && (
                        <p className="text-[11px] text-amber-600">Webhook no configurado</p>
                      )}

                      {published && days !== null && (
                        <div className={`mt-auto text-[11px] font-medium ${getDaysColorClass(days)}`}>
                          {formatDaysText(days)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isContentModalOpen} onOpenChange={setIsContentModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Contenido para redes</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Título</label>
              <Input
                value={pendingTitle}
                onChange={(e) => setPendingTitle(e.target.value)}
                className="font-semibold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Descripción</label>
              <Textarea
                value={pendingDescription}
                onChange={(e) => setPendingDescription(e.target.value)}
                rows={10}
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-mist shrink-0">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setPendingDescription(vehicle.description);
                  setPendingTitle(defaultVehicleTitle(vehicle));
                }}
                className="text-sm font-medium text-brand hover:text-brand-600 underline"
              >
                Restaurar valores originales
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingDescription(generateTechnicalDescription(vehicle));
                  setPendingTitle(defaultVehicleTitle(vehicle));
                }}
                className="text-sm font-medium text-brand hover:text-brand-600 underline"
              >
                Generar descripción técnica
              </button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsContentModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => void handleSaveContent()}
                disabled={isSavingContent}
                className="bg-brand hover:bg-brand-600 text-white"
              >
                {isSavingContent ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent className="max-w-md">
          {selectedPlatform && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <img
                    src={PLATFORM_LOGOS[selectedPlatform]}
                    alt=""
                    className="h-8 w-8 object-contain"
                  />
                  <DialogTitle>{PLATFORM_LABELS[selectedPlatform]}</DialogTitle>
                </div>
              </DialogHeader>

              {actionError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{actionError}</div>
              )}
              {actionSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">
                  {actionSuccess}
                </div>
              )}

              {isLoading ? (
                <div className="py-8 flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-brand mb-2" />
                  <span className="text-sm text-slate2">Procesando…</span>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between p-3 bg-paper rounded-lg border border-mist">
                    <span className="text-sm text-slate2">Estado actual:</span>
                    <span
                      className={`text-xs font-bold ${selectedPublished ? "text-emerald-600" : "text-slate2"}`}
                    >
                      {selectedPublished ? "PUBLICADO" : "SIN PUBLICAR"}
                    </span>
                  </div>

                  {!isSocialAutomationConfigured(selectedPlatform) && (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                      Configurá el webhook de {PLATFORM_LABELS[selectedPlatform]} en las variables de
                      entorno (VITE_N8N_WEBHOOK_{selectedPlatform.toUpperCase()}).
                    </p>
                  )}

                  <div className="space-y-3">
                    {!selectedPublished && (
                      <button
                        type="button"
                        onClick={() => void handlePublishNow()}
                        disabled={!isSocialAutomationConfigured(selectedPlatform)}
                        className="w-full flex items-center gap-3 p-4 border-2 border-brand/20 rounded-xl hover:bg-brand/5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Share2 className="h-6 w-6 text-brand" />
                        <div className="text-left">
                          <div className="font-bold text-navy">Publicar ahora</div>
                          <div className="text-xs text-slate2">Subir post a la plataforma.</div>
                        </div>
                      </button>
                    )}
                    {selectedPublished && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleDeleteAndRepublish()}
                          disabled={!isSocialAutomationConfigured(selectedPlatform)}
                          className="w-full flex items-center gap-3 p-3 border border-mist rounded-lg hover:bg-blue-50 disabled:opacity-50"
                        >
                          <RotateCcw className="h-5 w-5 text-blue-600" />
                          <span>Actualizar / Republicar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeletePermanently()}
                          disabled={!isSocialAutomationConfigured(selectedPlatform)}
                          className="w-full flex items-center gap-3 p-3 border border-mist rounded-lg hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-5 w-5 text-red-600" />
                          <span>Eliminar publicación</span>
                        </button>
                      </>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setIsActionModalOpen(false)}
                    className="mt-4 w-full"
                  >
                    Cancelar
                  </Button>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
