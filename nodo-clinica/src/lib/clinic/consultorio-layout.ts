export type ConsultorioWidgetId =
  | "patient_queue"
  | "consultation_center"
  | "pending_payments"
  | "day_summary"
  | "personal_calendar";

export type ConsultorioZone = "top" | "left" | "center" | "right" | "bottom";

export type PatientQueueViewMode = "compact" | "comfortable" | "expandable";

export type ConsultorioLayoutPreset =
  | "default"
  | "minimal"
  | "full"
  | "teleconsulta";

export interface ConsultorioWidgetConfig {
  id: ConsultorioWidgetId;
  enabled: boolean;
  zone: ConsultorioZone;
  order: number;
}

export interface ConsultorioLayoutSettings {
  widgets: ConsultorioWidgetConfig[];
  queueViewMode: PatientQueueViewMode;
  welcomeMessage?: string;
  preset?: ConsultorioLayoutPreset;
}

export const CONSULTORIO_WIDGET_META: Record<
  ConsultorioWidgetId,
  {
    label: string;
    description: string;
    locked?: boolean;
    allowedZones: ConsultorioZone[];
  }
> = {
  patient_queue: {
    label: "Listado de pacientes",
    description: "Cola de turnos y acciones por paciente",
    allowedZones: ["left"],
  },
  consultation_center: {
    label: "Sala de consulta",
    description: "Videollamada, recetas, estudios e informes",
    locked: true,
    allowedZones: ["center"],
  },
  pending_payments: {
    label: "Pagos pendientes",
    description: "Comprobantes por validar",
    allowedZones: ["top"],
  },
  day_summary: {
    label: "Resumen del día",
    description: "Contadores de espera, consulta y finalizados",
    allowedZones: ["right", "bottom"],
  },
  personal_calendar: {
    label: "Calendario personal",
    description: "Google Calendar embebido",
    allowedZones: ["right", "bottom"],
  },
};

const DEFAULT_WIDGETS: ConsultorioWidgetConfig[] = [
  { id: "pending_payments", enabled: true, zone: "top", order: 0 },
  { id: "patient_queue", enabled: true, zone: "left", order: 0 },
  { id: "consultation_center", enabled: true, zone: "center", order: 0 },
  { id: "day_summary", enabled: true, zone: "right", order: 0 },
  { id: "personal_calendar", enabled: true, zone: "right", order: 1 },
];

export const DEFAULT_CONSULTORIO_LAYOUT: ConsultorioLayoutSettings = {
  widgets: DEFAULT_WIDGETS,
  queueViewMode: "compact",
  welcomeMessage: "",
  preset: "default",
};

const PRESETS: Record<
  ConsultorioLayoutPreset,
  ConsultorioLayoutSettings
> = {
  default: DEFAULT_CONSULTORIO_LAYOUT,
  minimal: {
    widgets: [
      { id: "pending_payments", enabled: false, zone: "top", order: 0 },
      { id: "patient_queue", enabled: true, zone: "left", order: 0 },
      { id: "consultation_center", enabled: true, zone: "center", order: 0 },
      { id: "day_summary", enabled: true, zone: "right", order: 0 },
      { id: "personal_calendar", enabled: false, zone: "right", order: 1 },
    ],
    queueViewMode: "compact",
    preset: "minimal",
  },
  full: {
    widgets: [
      { id: "pending_payments", enabled: true, zone: "top", order: 0 },
      { id: "patient_queue", enabled: true, zone: "left", order: 0 },
      { id: "consultation_center", enabled: true, zone: "center", order: 0 },
      { id: "day_summary", enabled: true, zone: "right", order: 0 },
      { id: "personal_calendar", enabled: true, zone: "bottom", order: 0 },
    ],
    queueViewMode: "expandable",
    preset: "full",
  },
  teleconsulta: {
    widgets: [
      { id: "pending_payments", enabled: false, zone: "top", order: 0 },
      { id: "patient_queue", enabled: true, zone: "left", order: 0 },
      { id: "consultation_center", enabled: true, zone: "center", order: 0 },
      { id: "day_summary", enabled: false, zone: "right", order: 0 },
      { id: "personal_calendar", enabled: false, zone: "right", order: 1 },
    ],
    queueViewMode: "comfortable",
    preset: "teleconsulta",
  },
};

function normalizeWidget(
  partial: Partial<ConsultorioWidgetConfig> & { id: ConsultorioWidgetId },
): ConsultorioWidgetConfig {
  const meta = CONSULTORIO_WIDGET_META[partial.id];
  const fallback = DEFAULT_WIDGETS.find((w) => w.id === partial.id)!;
  const zone =
    partial.zone && meta.allowedZones.includes(partial.zone)
      ? partial.zone
      : fallback.zone;
  return {
    id: partial.id,
    enabled: partial.enabled ?? fallback.enabled,
    zone,
    order: partial.order ?? fallback.order,
  };
}

export function mergeConsultorioLayout(
  partial?: Partial<ConsultorioLayoutSettings> | null,
): ConsultorioLayoutSettings {
  if (!partial) return { ...DEFAULT_CONSULTORIO_LAYOUT, widgets: [...DEFAULT_WIDGETS] };

  const widgetMap = new Map<ConsultorioWidgetId, ConsultorioWidgetConfig>();
  for (const w of DEFAULT_WIDGETS) {
    widgetMap.set(w.id, { ...w });
  }
  for (const w of partial.widgets ?? []) {
    if (!w?.id) continue;
    widgetMap.set(w.id, normalizeWidget({ ...widgetMap.get(w.id), ...w, id: w.id }));
  }

  const widgets = [...widgetMap.values()].sort((a, b) => {
    if (a.zone !== b.zone) {
      const zoneOrder: ConsultorioZone[] = [
        "top",
        "left",
        "center",
        "right",
        "bottom",
      ];
      return zoneOrder.indexOf(a.zone) - zoneOrder.indexOf(b.zone);
    }
    return a.order - b.order;
  });

  const queueViewMode =
    partial.queueViewMode ?? DEFAULT_CONSULTORIO_LAYOUT.queueViewMode;

  return {
    widgets,
    queueViewMode,
    welcomeMessage: partial.welcomeMessage ?? "",
    preset: partial.preset ?? "default",
  };
}

export function applyConsultorioPreset(
  preset: ConsultorioLayoutPreset,
): ConsultorioLayoutSettings {
  const base = PRESETS[preset] ?? PRESETS.default;
  return mergeConsultorioLayout(base);
}

export function widgetsInZone(
  layout: ConsultorioLayoutSettings,
  zone: ConsultorioZone,
): ConsultorioWidgetConfig[] {
  return layout.widgets
    .filter((w) => w.enabled && w.zone === zone)
    .sort((a, b) => a.order - b.order);
}

export function isWidgetEnabled(
  layout: ConsultorioLayoutSettings,
  id: ConsultorioWidgetId,
): boolean {
  return layout.widgets.find((w) => w.id === id)?.enabled ?? false;
}

export function moveWidgetInZone(
  layout: ConsultorioLayoutSettings,
  id: ConsultorioWidgetId,
  direction: "up" | "down",
): ConsultorioLayoutSettings {
  const widget = layout.widgets.find((w) => w.id === id);
  if (!widget) return layout;

  const siblings = widgetsInZone(layout, widget.zone);
  const index = siblings.findIndex((w) => w.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= siblings.length) return layout;

  const swap = siblings[swapIndex];
  const nextWidgets = layout.widgets.map((w) => {
    if (w.id === id) return { ...w, order: swap.order };
    if (w.id === swap.id) return { ...w, order: widget.order };
    return w;
  });

  return mergeConsultorioLayout({ ...layout, widgets: nextWidgets });
}

export function setWidgetEnabled(
  layout: ConsultorioLayoutSettings,
  id: ConsultorioWidgetId,
  enabled: boolean,
): ConsultorioLayoutSettings {
  if (CONSULTORIO_WIDGET_META[id].locked) return layout;
  return mergeConsultorioLayout({
    ...layout,
    widgets: layout.widgets.map((w) =>
      w.id === id ? { ...w, enabled } : w,
    ),
    preset: "default",
  });
}

export function setWidgetZone(
  layout: ConsultorioLayoutSettings,
  id: ConsultorioWidgetId,
  zone: ConsultorioZone,
): ConsultorioLayoutSettings {
  const meta = CONSULTORIO_WIDGET_META[id];
  if (!meta.allowedZones.includes(zone)) return layout;

  const maxOrder = layout.widgets
    .filter((w) => w.zone === zone && w.id !== id)
    .reduce((max, w) => Math.max(max, w.order), -1);

  return mergeConsultorioLayout({
    ...layout,
    widgets: layout.widgets.map((w) =>
      w.id === id ? { ...w, zone, order: maxOrder + 1 } : w,
    ),
    preset: "default",
  });
}

export const QUEUE_VIEW_LABELS: Record<PatientQueueViewMode, string> = {
  compact: "Compacta (hora + nombre, desplegable)",
  comfortable: "Estándar (hora + nombre, desplegable)",
  expandable: "Con historia clínica al desplegar",
};
