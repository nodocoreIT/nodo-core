import {
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileText,
  MapPin,
  Wrench,
} from "lucide-react";
import type { AgendaCategory } from "@nodocore/nodo-modules/agenda";

export const INMO_TASK_CATEGORIES: AgendaCategory[] = [
  { value: "general", label: "General", icon: CheckCircle2, bg: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "visita", label: "Visita/Muestra", icon: MapPin, bg: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "firma", label: "Firma de Contrato", icon: FileText, bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "cobro", label: "Cobro/Alquiler", icon: DollarSign, bg: "bg-green-50 text-green-700 border-green-200" },
  { value: "mantenimiento", label: "Mantenimiento", icon: Wrench, bg: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "tramite", label: "Trámite/Papelería", icon: ClipboardList, bg: "bg-purple-50 text-purple-700 border-purple-200" },
];

export const INMO_CATEGORY_LABELS = Object.fromEntries(
  INMO_TASK_CATEGORIES.map((category) => [category.value, category.label]),
);
