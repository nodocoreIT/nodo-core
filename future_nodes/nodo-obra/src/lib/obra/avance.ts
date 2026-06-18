import { randomUUID } from "crypto";
import type { LocalProyecto, LocalProyectoRubro, ObraDatabase } from "@/lib/obra/types";

export function getRubrosProgresoProyecto(db: ObraDatabase, proyectoId: string) {
  return db.rubrosProgreso.filter((r) => r.proyectoId === proyectoId);
}

export function montoGastoRubro(
  db: ObraDatabase,
  proyectoId: string,
  rubroNombre: string,
) {
  const nombre = rubroNombre.trim().toLowerCase();
  return db.gastos
    .filter((g) => g.proyectoId === proyectoId)
    .filter((g) => {
      if (!g.rubroId) return false;
      const rubro = db.rubros.find((r) => r.id === g.rubroId);
      return rubro?.nombre.trim().toLowerCase() === nombre;
    })
    .reduce((sum, g) => sum + g.montoTicket, 0);
}

export function computeAvanceFromRubros(db: ObraDatabase, proyectoId: string) {
  const rubros = getRubrosProgresoProyecto(db, proyectoId);
  if (rubros.length === 0) return null;
  const suma = rubros.reduce((acc, r) => acc + r.porcentajeAvance, 0);
  return Math.round(suma / rubros.length);
}

export function resolveAvanceProyecto(
  db: ObraDatabase,
  proyecto: LocalProyecto,
): number {
  const rubros = getRubrosProgresoProyecto(db, proyecto.id);
  if (rubros.length > 0) {
    return proyecto.avanceProgreso ?? computeAvanceFromRubros(db, proyecto.id) ?? 0;
  }

  const tareas = db.tareas.filter((t) => t.proyectoId === proyecto.id);
  if (tareas.length === 0) return proyecto.avanceProgreso ?? 0;
  const terminadas = tareas.filter((t) => t.completada).length;
  return Math.round((terminadas / tareas.length) * 100);
}

export function buildRubrosProgresoView(db: ObraDatabase, proyectoId: string) {
  return getRubrosProgresoProyecto(db, proyectoId).map((rubro) => ({
    id: rubro.id,
    nombre: rubro.nombre,
    porcentajeAvance: rubro.porcentajeAvance,
    montoGasto: montoGastoRubro(db, proyectoId, rubro.nombre),
  }));
}

export function recalcularAvanceProyecto(
  db: ObraDatabase,
  proyectoId: string,
): number {
  const idx = db.proyectos.findIndex((p) => p.id === proyectoId);
  if (idx < 0) return 0;

  const avance =
    computeAvanceFromRubros(db, proyectoId) ??
    db.proyectos[idx].avanceProgreso ??
    0;

  db.proyectos[idx] = {
    ...db.proyectos[idx],
    avanceProgreso: avance,
  };

  return avance;
}

export function createDefaultRubrosProgreso(
  proyectoId: string,
  nombres: string[],
): LocalProyectoRubro[] {
  return nombres.map((nombre) => ({
    id: randomUUID(),
    proyectoId,
    nombre,
    porcentajeAvance: 0,
  }));
}
