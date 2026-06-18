import { randomUUID } from "crypto";
import type {
  LocalPresupuesto,
  LocalProyecto,
  ObraDatabase,
  PresupuestoEstado,
  PresupuestoResumen,
  PresupuestoRubroLine,
} from "@/lib/obra/types";

export const PRESUPUESTO_ESTADO_LABELS: Record<PresupuestoEstado, string> = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado al cliente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  CONVERTIDO: "Convertido en obra",
};

export function subtotalPresupuesto(rubros: PresupuestoRubroLine[]) {
  return rubros.reduce((sum, r) => sum + r.manoObra + r.materiales, 0);
}

export function totalPresupuesto(
  rubros: PresupuestoRubroLine[],
  porcentajeContingencia: number,
) {
  const subtotal = subtotalPresupuesto(rubros);
  const contingencia = subtotal * (porcentajeContingencia / 100);
  return {
    subtotal,
    contingencia,
    total: subtotal + contingencia,
  };
}

export function buildPresupuestoResumen(
  db: ObraDatabase,
  presupuesto: LocalPresupuesto,
): PresupuestoResumen {
  const { subtotal, contingencia, total } = totalPresupuesto(
    presupuesto.rubros,
    presupuesto.porcentajeContingencia,
  );
  const cliente = presupuesto.clienteId
    ? db.clientes.find((c) => c.id === presupuesto.clienteId)
    : null;

  return {
    id: presupuesto.id,
    titulo: presupuesto.titulo,
    clienteNombre: cliente?.nombre ?? "Sin cliente",
    direccionObra: presupuesto.direccionObra,
    estado: presupuesto.estado,
    estadoLabel: PRESUPUESTO_ESTADO_LABELS[presupuesto.estado],
    subtotal,
    contingencia,
    total,
    rubrosCount: presupuesto.rubros.length,
    proyectoId: presupuesto.proyectoId,
    updatedAt: presupuesto.updatedAt,
  };
}

export function puedeConvertirPresupuesto(presupuesto: LocalPresupuesto) {
  return (
    presupuesto.estado !== "CONVERTIDO" &&
    presupuesto.estado !== "RECHAZADO" &&
    !presupuesto.proyectoId &&
    presupuesto.rubros.length > 0
  );
}

export function convertirPresupuestoEnObra(
  db: ObraDatabase,
  presupuestoId: string,
): { presupuesto: LocalPresupuesto; proyecto: LocalProyecto } {
  const idx = db.presupuestos.findIndex((p) => p.id === presupuestoId);
  if (idx < 0) throw new Error("Presupuesto no encontrado");

  const presupuesto = db.presupuestos[idx];
  if (!puedeConvertirPresupuesto(presupuesto)) {
    throw new Error("Este presupuesto no puede convertirse en obra");
  }

  const { total } = totalPresupuesto(
    presupuesto.rubros,
    presupuesto.porcentajeContingencia,
  );
  const now = new Date().toISOString();
  const proyectoId = randomUUID();

  const proyecto: LocalProyecto = {
    id: proyectoId,
    nombre: presupuesto.titulo,
    clienteId: presupuesto.clienteId,
    direccionObra: presupuesto.direccionObra,
    tipoInmueble: presupuesto.tipoInmueble,
    fechaInicio: now.slice(0, 10),
    plazoMeses: presupuesto.plazoMeses,
    encargado: presupuesto.encargado,
    porcentajeContingencia: presupuesto.porcentajeContingencia,
    presupuestoEstimado: Math.round(total),
    porcentajeComisionDireccion: 10,
    tipoHonorario: "PORCENTAJE",
    valorHonorario: 10,
    estado: "PLAN",
    notas: presupuesto.notas
      ? `${presupuesto.notas}\n\nGenerada desde presupuesto ${presupuesto.id.slice(0, 8)}.`
      : `Generada desde presupuesto ${presupuesto.id.slice(0, 8)}.`,
    avanceProgreso: 0,
    origenPresupuestoId: presupuesto.id,
    inmoPropertyId: presupuesto.inmoPropertyId,
    inmoPropertyLabel: presupuesto.inmoPropertyLabel,
    createdAt: now,
  };

  db.proyectos.push(proyecto);

  for (const line of presupuesto.rubros) {
    db.rubrosProgreso.push({
      id: randomUUID(),
      proyectoId,
      nombre: line.rubroNombre,
      porcentajeAvance: 0,
    });

    db.tareas.push({
      id: randomUUID(),
      proyectoId,
      titulo: line.rubroNombre,
      contenido: line.notas,
      completada: false,
      fechaCreacion: now,
      fechaLimite: null,
      tipo: "operativa",
      presupuestoManoObra: line.manoObra,
      presupuestoMateriales: line.materiales,
    });
  }

  db.presupuestos[idx] = {
    ...presupuesto,
    estado: "CONVERTIDO",
    proyectoId,
    aprobadoAt: presupuesto.aprobadoAt ?? now,
    updatedAt: now,
  };

  return { presupuesto: db.presupuestos[idx], proyecto };
}

export function buildDefaultRubroLines(
  nombres: string[],
): PresupuestoRubroLine[] {
  return nombres.map((rubroNombre) => ({
    id: randomUUID(),
    rubroNombre,
    manoObra: 0,
    materiales: 0,
    notas: "",
  }));
}
