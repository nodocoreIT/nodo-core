import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/obra/local-db";
import { requireStaffSession } from "@/lib/obra/session";
import type { TareaTipo } from "@/lib/obra/types";

export async function POST(request: NextRequest) {
  const session = await requireStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const proyectoId = body.proyectoId as string;
  const titulo = String(body.titulo ?? "").trim();
  const tipo = (body.tipo ?? "operativa") as TareaTipo;

  if (!proyectoId || !titulo) {
    return NextResponse.json(
      { error: "Obra y título requeridos" },
      { status: 400 },
    );
  }

  const db = await readDb();
  if (!db.proyectos.some((p) => p.id === proyectoId)) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
  }

  let tituloFinal = titulo;
  let fechaLimite: string | null = body.fechaLimite ?? null;
  if (body.fechaHora) {
    try {
      const dt = new Date(body.fechaHora);
      fechaLimite = dt.toISOString().slice(0, 10);
      const hora = dt.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const dia = dt.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
      });
      tituloFinal = `[${dia} ${hora}] ${titulo}`;
    } catch {
      /* keep original titulo */
    }
  }

  const tarea = {
    id: randomUUID(),
    proyectoId,
    titulo: tituloFinal,
    contenido: String(body.contenido ?? ""),
    completada: false,
    fechaCreacion: new Date().toISOString(),
    fechaLimite,
    tipo,
    presupuestoManoObra: 0,
    presupuestoMateriales: 0,
  };

  db.tareas.push(tarea);
  await writeDb(db);
  return NextResponse.json({ tarea }, { status: 201 });
}
