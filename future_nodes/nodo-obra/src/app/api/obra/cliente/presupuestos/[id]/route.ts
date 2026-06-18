import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/obra/local-db";
import { buildPresupuestoResumen } from "@/lib/obra/presupuestos";
import { getSessionFromRequest } from "@/lib/obra/session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "cliente") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const accion = body.accion as "aprobar" | "rechazar";

  if (accion !== "aprobar" && accion !== "rechazar") {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  const db = await readDb();
  const idx = db.presupuestos.findIndex((p) => p.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  }

  const presupuesto = db.presupuestos[idx];
  if (presupuesto.clienteId !== session.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (presupuesto.estado !== "ENVIADO") {
    return NextResponse.json(
      { error: "Este presupuesto ya fue respondido" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  db.presupuestos[idx] = {
    ...presupuesto,
    estado: accion === "aprobar" ? "APROBADO" : "RECHAZADO",
    aprobadoAt: accion === "aprobar" ? now : presupuesto.aprobadoAt,
    updatedAt: now,
  };

  await writeDb(db);
  return NextResponse.json({
    presupuesto: db.presupuestos[idx],
    resumen: buildPresupuestoResumen(db, db.presupuestos[idx]),
  });
}
