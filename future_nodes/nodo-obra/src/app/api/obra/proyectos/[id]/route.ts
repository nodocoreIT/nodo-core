import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, getProyectoById } from "@/lib/obra/local-db";
import { buildRubrosProgresoView } from "@/lib/obra/avance";
import { buildProyectoDashboard } from "@/lib/obra/stats";
import { requireStaffSession } from "@/lib/obra/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const db = await readDb();
  const proyecto = getProyectoById(db, id);
  if (!proyecto) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
  }

  const cliente = proyecto.clienteId
    ? db.clientes.find((c) => c.id === proyecto.clienteId) ?? null
    : null;
  const tareas = db.tareas.filter((t) => t.proyectoId === id);
  const gastos = db.gastos.filter((g) => g.proyectoId === id);

  return NextResponse.json({
    proyecto,
    cliente,
    tareas,
    gastos,
    rubrosProgreso: buildRubrosProgresoView(db, id),
    resumen: buildProyectoDashboard(db, proyecto),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const db = await readDb();
  const idx = db.proyectos.findIndex((p) => p.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
  }

  db.proyectos[idx] = { ...db.proyectos[idx], ...body, id };
  await writeDb(db);
  return NextResponse.json({ proyecto: db.proyectos[idx] });
}
