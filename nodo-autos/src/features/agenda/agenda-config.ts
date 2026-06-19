import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  MapPin,
  Share2,
  Wrench,
} from "lucide-react";
import type { AgendaCategory } from "@nodocore/nodo-modules/agenda";

export const AUTOS_TASK_CATEGORIES: AgendaCategory[] = [
  { value: "general", label: "General", icon: CheckCircle2, bg: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "visita", label: "Visita / Prueba", icon: MapPin, bg: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "entrega", label: "Entrega", icon: Calendar, bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "publicacion", label: "Publicación", icon: Share2, bg: "bg-sky-50 text-sky-700 border-sky-200" },
  { value: "tramite", label: "Trámite", icon: ClipboardList, bg: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "seguimiento", label: "Seguimiento", icon: DollarSign, bg: "bg-green-50 text-green-700 border-green-200" },
  { value: "mantenimiento", label: "Preparación", icon: Wrench, bg: "bg-blue-50 text-blue-700 border-blue-200" },
];

export const AUTOS_CATEGORY_LABELS = Object.fromEntries(
  AUTOS_TASK_CATEGORIES.map((c) => [c.value, c.label]),
);
