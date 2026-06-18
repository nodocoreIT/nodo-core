import { NextRequest, NextResponse } from "next/server";
import { readDb, publicCliente } from "@/lib/obra/local-db";
import { buildPresupuestoResumen } from "@/lib/obra/presupuestos";
import { buildProyectoDashboard } from "@/lib/obra/stats";
import { getSessionFromRequest } from "@/lib/obra/session";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "cliente") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = await readDb();
  const cliente = db.clientes.find((c) => c.id === session.userId);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const proyectos = db.proyectos
    .filter((p) => p.clienteId === cliente.id)
    .map((p) => ({
      ...buildProyectoDashboard(db, p),
      notas: p.notas,
      tareas: db.tareas
        .filter((t) => t.proyectoId === p.id)
        .map(({ titulo, completada, fechaLimite }) => ({
          titulo,
          completada,
          fechaLimite,
        })),
      fotos: db.fotosAvance
        .filter((f) => f.proyectoId === p.id)
        .sort((a, b) => b.fechaAvance.localeCompare(a.fechaAvance)),
    }));

  const presupuestos = db.presupuestos
    .filter(
      (p) =>
        p.clienteId === cliente.id &&
        (p.estado === "ENVIADO" ||
          p.estado === "APROBADO" ||
          p.estado === "RECHAZADO" ||
          p.estado === "CONVERTIDO"),
    )
    .map((p) => buildPresupuestoResumen(db, p))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return NextResponse.json({
    cliente: publicCliente(cliente),
    proyectos,
    presupuestos,
  });
}
