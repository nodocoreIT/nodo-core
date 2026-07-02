"use client";

import type { ReactNode } from "react";
import {
  widgetsInZone,
  type ConsultorioLayoutSettings,
  type ConsultorioWidgetId,
} from "@/lib/clinic/consultorio-layout";
import { cn } from "@/lib/utils";
import { LayoutGrid } from "lucide-react";

interface ConsultorioWorkspaceProps {
  layout: ConsultorioLayoutSettings;
  editMode?: boolean;
  welcomeName?: string;
  widgets: Partial<Record<ConsultorioWidgetId, ReactNode>>;
}

function ZoneShell({
  children,
  className,
  label,
  editMode,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  editMode?: boolean;
}) {
  if (!children) return null;
  return (
    <div
      className={cn(
        "relative",
        editMode && "ring-2 ring-dashed ring-brand/30 rounded-xl",
        className,
      )}
    >
      {editMode && label && (
        <span className="absolute -top-2.5 left-3 z-10 bg-paper px-2 text-[10px] font-bold uppercase tracking-wide text-brand">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

export function ConsultorioWorkspace({
  layout,
  editMode,
  welcomeName,
  widgets,
}: ConsultorioWorkspaceProps) {
  const top = widgetsInZone(layout, "top");
  const left = widgetsInZone(layout, "left");
  const center = widgetsInZone(layout, "center");
  const right = widgetsInZone(layout, "right");
  const bottom = widgetsInZone(layout, "bottom");

  const hasLeft = left.some((w) => widgets[w.id]);
  const hasRight = right.some((w) => widgets[w.id]);
  const centerSpan =
    hasLeft && hasRight ? "lg:col-span-6" : hasLeft || hasRight ? "lg:col-span-9" : "lg:col-span-12";
  const leftSpan = hasRight ? "lg:col-span-3" : "lg:col-span-4";
  const rightSpan = hasLeft ? "lg:col-span-3" : "lg:col-span-4";

  const renderZone = (zoneWidgets: typeof top) =>
    zoneWidgets.map((w) => widgets[w.id]).filter(Boolean);

  const welcome =
    layout.welcomeMessage?.trim() ||
    (welcomeName ? `Consultorio de ${welcomeName}` : "");

  return (
    <div className="space-y-4">
      {welcome && (
        <div className="rounded-xl border border-border bg-gradient-to-r from-navy-900 to-navy-800 px-4 py-3 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-brand shrink-0" />
            <p className="text-sm font-semibold">{welcome}</p>
          </div>
        </div>
      )}

      {top.length > 0 && (
        <ZoneShell label="Arriba" editMode={editMode} className="space-y-3">
          {renderZone(top)}
        </ZoneShell>
      )}

      <div className="grid grid-cols-12 gap-4">
        {hasLeft && (
          <ZoneShell
            label="Pacientes"
            editMode={editMode}
            className={cn("col-span-12 min-h-[500px]", leftSpan)}
          >
            <div className="h-full space-y-3">{renderZone(left)}</div>
          </ZoneShell>
        )}

        <ZoneShell
          label="Consulta"
          editMode={editMode}
          className={cn("col-span-12 space-y-4 min-h-[500px]", centerSpan)}
        >
          {renderZone(center)}
        </ZoneShell>

        {hasRight && (
          <ZoneShell
            label="Lateral"
            editMode={editMode}
            className={cn("col-span-12 min-h-[500px]", rightSpan)}
          >
            <div className="h-full flex flex-col gap-3">{renderZone(right)}</div>
          </ZoneShell>
        )}
      </div>

      {bottom.length > 0 && (
        <ZoneShell label="Abajo" editMode={editMode} className="space-y-3">
          {renderZone(bottom)}
        </ZoneShell>
      )}
    </div>
  );
}
