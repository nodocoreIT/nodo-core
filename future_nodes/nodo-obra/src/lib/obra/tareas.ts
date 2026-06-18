import type { LocalTarea, TareaTipo } from "@/lib/obra/types";

export const TAREA_TIPO_LABELS: Record<TareaTipo, string> = {
  operativa: "Interna",
  propietario: "Propietario",
  agenda: "Agenda",
  logistica: "Logística",
  caja: "Caja",
};

export function isTareaPropietario(tarea: LocalTarea) {
  return tarea.tipo === "propietario";
}

export function splitTareasPorSeccion(tareas: LocalTarea[]) {
  const internas = tareas.filter((t) => !isTareaPropietario(t));
  const propietario = tareas.filter(isTareaPropietario);
  return {
    internas: sortPendientesInternos(internas),
    propietario: sortPendientesPropietario(propietario),
  };
}

function sortPendientesInternos(tareas: LocalTarea[]) {
  return [...tareas].sort((a, b) => {
    if (a.completada !== b.completada) return Number(a.completada) - Number(b.completada);
    return b.fechaCreacion.localeCompare(a.fechaCreacion);
  });
}

function sortPendientesPropietario(tareas: LocalTarea[]) {
  return [...tareas].sort((a, b) => {
    if (a.completada !== b.completada) return Number(a.completada) - Number(b.completada);
    if (a.fechaLimite && b.fechaLimite) {
      return a.fechaLimite.localeCompare(b.fechaLimite);
    }
    if (a.fechaLimite) return -1;
    if (b.fechaLimite) return 1;
    return b.fechaCreacion.localeCompare(a.fechaCreacion);
  });
}

export function formatFechaLimite(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}
