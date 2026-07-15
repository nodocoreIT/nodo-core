"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  History,
  FileText,
  Download,
  Stethoscope,
  Loader2,
  Pill,
  FlaskConical,
  Brain,
  Calendar,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type {
  PatientTimelineItem,
  TimelineItemKind,
} from "@/lib/clinic/patient-timeline";
import { timelineKindLabel } from "@/lib/clinic/patient-timeline";

interface PatientHistorySectionProps {
  patientId: string;
  timeline: PatientTimelineItem[];
  loading?: boolean;
}

type FilterValue = "all" | TimelineItemKind;

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "Todo" },
  { value: "consulta", label: "Consultas" },
  { value: "documento", label: "Archivos" },
  { value: "receta", label: "Recetas" },
  { value: "estudio", label: "Estudios" },
  { value: "informe", label: "Informes" },
  { value: "soap", label: "SOAP" },
  { value: "evolucion", label: "Evolución" },
];

const KIND_ICONS: Record<TimelineItemKind, typeof Stethoscope> = {
  consulta: Calendar,
  documento: FileText,
  receta: Pill,
  estudio: FlaskConical,
  informe: Stethoscope,
  soap: Brain,
  evolucion: History,
};

const KIND_COLORS: Record<TimelineItemKind, string> = {
  consulta: "bg-blue-100 text-blue-700 border-blue-200",
  documento: "bg-slate-100 text-slate-700 border-slate-200",
  receta: "bg-indigo-100 text-indigo-700 border-indigo-200",
  estudio: "bg-cyan-100 text-cyan-700 border-cyan-200",
  informe: "bg-violet-100 text-violet-700 border-violet-200",
  soap: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  evolucion: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Programado",
  waiting: "En espera",
  in_consultation: "En consulta",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

function TimelineEntry({ item }: { item: PatientTimelineItem }) {
  const Icon = KIND_ICONS[item.kind];
  const [expanded, setExpanded] = useState(false);
  const hasContent = !!item.content?.trim();

  return (
    <div className="relative pl-8 pb-6 last:pb-0">
      <span className="absolute left-[11px] top-0 bottom-0 w-px bg-slate-200 last:hidden" />
      <span
        className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border ${KIND_COLORS[item.kind]}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>

      <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <Badge
                variant="outline"
                className={`text-[10px] ${KIND_COLORS[item.kind]}`}
              >
                {timelineKindLabel(item.kind)}
              </Badge>
              {item.status && (
                <Badge variant="outline" className="text-[10px]">
                  {STATUS_LABEL[item.status] ?? item.status}
                </Badge>
              )}
            </div>
            <p className="font-medium text-sm text-slate-800">{item.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {format(new Date(item.date), "dd MMM yyyy · HH:mm", { locale: es })}
              {item.doctorName && ` · Dr/a. ${item.doctorName}`}
              {item.subtitle && item.kind === "consulta" && ` · ${item.subtitle}`}
            </p>
          </div>

          {item.downloadUrl && (
            <a
              href={item.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              title="Descargar PDF"
            >
              <Download className="h-3.5 w-3.5" />
              {item.kind === "receta" || item.kind === "estudio"
                ? "Ver PDF"
                : "Descargar"}
            </a>
          )}
        </div>

        {hasContent && (
          <div className="mt-2">
            <p
              className={`text-xs text-slate-600 whitespace-pre-wrap ${
                expanded ? "" : "line-clamp-3"
              }`}
            >
              {item.content}
            </p>
            {item.content!.length > 180 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-0 text-xs text-emerald-700 mt-1"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Ver menos" : "Ver más"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function PatientHistorySection({
  timeline = [],
  loading = false,
}: PatientHistorySectionProps) {
  const [filter, setFilter] = useState<FilterValue>("all");

  const filtered = useMemo(() => {
    const items = timeline ?? [];
    if (filter === "all") return items;
    return items.filter((item) => item.kind === filter);
  }, [timeline, filter]);

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5 text-emerald-600" />
          Línea de tiempo clínica
        </CardTitle>
        <p className="text-sm text-slate-500">
          Consultas, estudios, recetas, informes y evoluciones en orden cronológico
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          {FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={filter === opt.value ? "default" : "outline"}
              className={
                filter === opt.value
                  ? "bg-emerald-600 hover:bg-emerald-700 h-7 text-xs shrink-0"
                  : "h-7 text-xs shrink-0"
              }
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">
            {filter === "all"
              ? "Todavía no hay eventos en tu historial clínico"
              : "No hay eventos de este tipo en tu historial"}
          </p>
        ) : (
          <div className="mt-2">
            {filtered.map((item) => (
              <TimelineEntry key={item.id} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
