"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyConsultorioPreset,
  mergeConsultorioLayout,
  moveWidgetInZone,
  setWidgetEnabled,
  setWidgetZone,
  type ConsultorioLayoutPreset,
  type ConsultorioLayoutSettings,
  CONSULTORIO_WIDGET_META,
  QUEUE_VIEW_LABELS,
  type PatientQueueViewMode,
} from "@/lib/clinic/consultorio-layout";
import { clinicApi } from "@/lib/clinic/client-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  LayoutGrid,
  Loader2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PRESET_OPTIONS: {
  value: ConsultorioLayoutPreset;
  label: string;
  hint: string;
}[] = [
  { value: "default", label: "Estándar", hint: "Cola, resumen y calendario" },
  { value: "minimal", label: "Minimal", hint: "Solo cola y consulta" },
  { value: "full", label: "Completo", hint: "Calendario abajo, cola expandible" },
  {
    value: "teleconsulta",
    label: "Teleconsulta",
    hint: "Foco en video, sin extras",
  },
];

const ZONE_LABELS: Record<string, string> = {
  top: "Arriba (ancho completo)",
  left: "Columna izquierda",
  center: "Centro (consulta)",
  right: "Columna derecha",
  bottom: "Abajo (ancho completo)",
};

interface ConsultorioLayoutEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: ConsultorioLayoutSettings;
  onLayoutChange: (layout: ConsultorioLayoutSettings) => void;
}

export function ConsultorioLayoutEditor({
  open,
  onOpenChange,
  layout,
  onLayoutChange,
}: ConsultorioLayoutEditorProps) {
  const [draft, setDraft] = useState(layout);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(mergeConsultorioLayout(layout));
  }, [open, layout]);

  const updateDraft = useCallback(
    (next: ConsultorioLayoutSettings) => {
      setDraft(mergeConsultorioLayout(next));
    },
    [],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await clinicApi.saveDoctorOffice({ consultorioLayout: draft });
      onLayoutChange(draft);
      toast.success("Consultorio personalizado guardado");
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo guardar el layout",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto px-6 sm:px-8 [&>button]:right-4"
      >
        <SheetHeader className="px-0 pt-2">
          <SheetTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-brand" />
            Personalizar consultorio
          </SheetTitle>
          <SheetDescription>
            Activá módulos, mové el calendario, elegí cómo ver la cola de
            pacientes. Se guarda en tu perfil médico.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-8 pb-8">
          <section className="space-y-3">
            <Label className="text-sm font-semibold text-navy">
              Plantilla rápida
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => updateDraft(applyConsultorioPreset(p.value))}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    draft.preset === p.value
                      ? "border-brand bg-brand/5"
                      : "border-border hover:border-brand/40",
                  )}
                >
                  <span className="block text-sm font-semibold text-ink">
                    {p.label}
                  </span>
                  <span className="block text-[11px] text-slate2 mt-0.5">
                    {p.hint}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <Label htmlFor="welcome-msg">Mensaje de bienvenida (opcional)</Label>
            <Input
              id="welcome-msg"
              placeholder="Ej: Bienvenido a mi consultorio virtual"
              value={draft.welcomeMessage ?? ""}
              onChange={(e) =>
                updateDraft({ ...draft, welcomeMessage: e.target.value })
              }
            />
          </section>

          <section className="space-y-3">
            <Label className="text-sm font-semibold text-navy">
              Vista del listado de pacientes
            </Label>
            <Select
              value={draft.queueViewMode}
              onValueChange={(v) =>
                updateDraft({
                  ...draft,
                  queueViewMode: v as PatientQueueViewMode,
                  preset: "default",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(QUEUE_VIEW_LABELS) as [
                    PatientQueueViewMode,
                    string,
                  ][]
                ).map(([mode, label]) => (
                  <SelectItem key={mode} value={mode}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate2">
              En modo expandible, cada paciente muestra motivo, documentos e
              historial al desplegar.
            </p>
          </section>

          <section className="space-y-3">
            <Label className="text-sm font-semibold text-navy">Módulos</Label>
            <div className="space-y-2">
              {draft.widgets.map((widget) => {
                const meta = CONSULTORIO_WIDGET_META[widget.id];
                const siblings = draft.widgets.filter(
                  (w) => w.zone === widget.zone && w.enabled,
                );
                const canMoveUp =
                  siblings.findIndex((w) => w.id === widget.id) > 0;
                const canMoveDown =
                  siblings.findIndex((w) => w.id === widget.id) <
                  siblings.length - 1;

                return (
                  <div
                    key={widget.id}
                    className={cn(
                      "rounded-xl border p-3 space-y-2",
                      widget.enabled
                        ? "border-border bg-white"
                        : "border-dashed border-slate-200 bg-slate-50/80 opacity-80",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {meta.label}
                          {meta.locked && (
                            <span className="ml-1 text-[10px] text-slate2 font-normal">
                              (siempre activo)
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate2">{meta.description}</p>
                      </div>
                      {!meta.locked && (
                        <Button
                          type="button"
                          size="sm"
                          variant={widget.enabled ? "default" : "outline"}
                          className="h-8 shrink-0"
                          onClick={() =>
                            updateDraft(
                              setWidgetEnabled(
                                draft,
                                widget.id,
                                !widget.enabled,
                              ),
                            )
                          }
                        >
                          {widget.enabled ? "Activo" : "Off"}
                        </Button>
                      )}
                    </div>

                    {widget.enabled && meta.allowedZones.length > 1 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-slate2" />
                        <Select
                          value={widget.zone}
                          onValueChange={(zone) =>
                            updateDraft(
                              setWidgetZone(
                                draft,
                                widget.id,
                                zone as typeof widget.zone,
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="h-8 text-xs flex-1 min-w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {meta.allowedZones.map((z) => (
                              <SelectItem key={z} value={z}>
                                {ZONE_LABELS[z]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            disabled={!canMoveUp}
                            onClick={() =>
                              updateDraft(
                                moveWidgetInZone(draft, widget.id, "up"),
                              )
                            }
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            disabled={!canMoveDown}
                            onClick={() =>
                              updateDraft(
                                moveWidgetInZone(draft, widget.id, "down"),
                              )
                            }
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <Button
            className="w-full bg-brand hover:bg-brand-600"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar mi consultorio
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
