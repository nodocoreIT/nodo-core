import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/obra/local-db";
import {
  buildPresupuestoResumen,
  convertirPresupuestoEnObra,
} from "@/lib/obra/presupuestos";
import { buildProyectoDashboard } from "@/lib/obra/stats";
import { requireStaffSession } from "@/lib/obra/session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const db = await readDb();

  try {
    const idx = db.presupuestos.findIndex((p) => p.id === id);
    if (idx < 0) {
      return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
    }

    if (db.presupuestos[idx].estado !== "APROBADO") {
      const now = new Date().toISOString();
      db.presupuestos[idx] = {
        ...db.presupuestos[idx],
        estado: "APROBADO",
        aprobadoAt: now,
        updatedAt: now,
      };
    }

    const { presupuesto, proyecto } = convertirPresupuestoEnObra(db, id);
    await writeDb(db);

    return NextResponse.json({
      presupuesto,
      resumen: buildPresupuestoResumen(db, presupuesto),
      proyecto,
      obraResumen: buildProyectoDashboard(db, proyecto),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo convertir" },
      { status: 400 },
    );
  }
}
