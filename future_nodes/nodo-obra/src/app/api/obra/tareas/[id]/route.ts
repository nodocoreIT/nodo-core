import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/obra/local-db";
import { requireStaffSession } from "@/lib/obra/session";

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
  const idx = db.tareas.findIndex((t) => t.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
  }

  if (typeof body.completada === "boolean") {
    db.tareas[idx].completada = body.completada;
  }
  if (typeof body.titulo === "string") {
    db.tareas[idx].titulo = body.titulo.trim();
  }

  await writeDb(db);
  return NextResponse.json({ tarea: db.tareas[idx] });
}
