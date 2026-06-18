import type {
  DashboardPayload,
  DashboardTarea,
  LocalProyecto,
  ObraDatabase,
  ProyectoEstado,
} from "@/lib/obra/types";
import { resolveAvanceProyecto } from "@/lib/obra/avance";

const ESTADO_LABELS: Record<ProyectoEstado, string> = {
  PLAN: "En Planificación",
  CURSO: "En Curso / Ejecución",
  FINALIZADO: "Obra Finalizada",
  SUSPENDIDO: "Suspendido",
};

export function porcentajeAvance(
  db: ObraDatabase,
  proyectoId: string,
): number {
  const proyecto = db.proyectos.find((p) => p.id === proyectoId);
  if (!proyecto) return 0;
  return resolveAvanceProyecto(db, proyecto);
}

export function gastoReal(db: ObraDatabase, proyectoId: string): number {
  return db.gastos
    .filter((g) => g.proyectoId === proyectoId)
    .reduce((sum, g) => sum + g.montoTicket, 0);
}

export function buildProyectoDashboard(
  db: ObraDatabase,
  proyecto: LocalProyecto,
) {
  const gasto = gastoReal(db, proyecto.id);
  const presupuesto = proyecto.presupuestoEstimado || 0;
  const avance = porcentajeAvance(db, proyecto.id);
  const porcentajeGasto =
    presupuesto > 0 ? Math.round((gasto / presupuesto) * 1000) / 10 : 0;
  const alertaDesvio =
    porcentajeGasto > avance + 15 || (presupuesto > 0 && gasto > presupuesto);

  return {
    id: proyecto.id,
    nombre: proyecto.nombre,
    propiedadVinculada:
      proyecto.inmoPropertyLabel ||
      proyecto.direccionObra ||
      "Sin dirección asignada",
    estado: proyecto.estado,
    estadoLabel: ESTADO_LABELS[proyecto.estado],
    presupuestoEstimado: presupuesto,
    gastoReal: gasto,
    porcentajeGasto,
    porcentajeAvance: avance,
    alertaDesvio,
    encargado: proyecto.encargado,
  };
}

export function buildDashboard(db: ObraDatabase): DashboardPayload {
  const obras = db.proyectos.map((p) => buildProyectoDashboard(db, p));
  const presupuestoTotal = obras.reduce(
    (s, o) => s + o.presupuestoEstimado,
    0,
  );
  const gastoTotal = obras.reduce((s, o) => s + o.gastoReal, 0);
  const porcentajeGlobal =
    presupuestoTotal > 0
      ? Math.round((gastoTotal / presupuestoTotal) * 1000) / 10
      : 0;

  const enrich = (t: (typeof db.tareas)[number]): DashboardTarea => ({
    ...t,
    proyectoNombre:
      db.proyectos.find((p) => p.id === t.proyectoId)?.nombre ?? "—",
  });

  const tareasPendientes = db.tareas.filter((t) => !t.completada);

  return {
    obras,
    totales: { presupuestoTotal, gastoTotal, porcentajeGlobal },
    obrasConDesvio: obras.filter((o) => o.alertaDesvio).length,
    tareasAgenda: tareasPendientes
      .filter((t) => t.tipo === "agenda")
      .map(enrich),
    tareasLogistica: tareasPendientes
      .filter((t) => t.tipo === "logistica")
      .map(enrich),
    tareasCaja: tareasPendientes.filter((t) => t.tipo === "caja").map(enrich),
  };
}
