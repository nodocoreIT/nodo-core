import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/obra/local-db";
import { recalcularAvanceProyecto } from "@/lib/obra/avance";
import { buildProyectoDashboard } from "@/lib/obra/stats";
import { requireStaffSession } from "@/lib/obra/session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: proyectoId } = await params;
  const body = await request.json();
  const porcentajeAvance = Number(body.porcentajeAvance);
  const rubroId = body.rubroId as string | null | undefined;

  if (
    Number.isNaN(porcentajeAvance) ||
    porcentajeAvance < 0 ||
    porcentajeAvance > 100
  ) {
    return NextResponse.json(
      { error: "El avance debe estar entre 0 y 100" },
      { status: 400 },
    );
  }

  const db = await readDb();
  const proyectoIdx = db.proyectos.findIndex((p) => p.id === proyectoId);
  if (proyectoIdx < 0) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
  }

  let nuevoAvanceGeneral: number;

  if (rubroId) {
    const rubroIdx = db.rubrosProgreso.findIndex(
      (r) => r.id === rubroId && r.proyectoId === proyectoId,
    );
    if (rubroIdx < 0) {
      return NextResponse.json({ error: "Rubro no encontrado" }, { status: 404 });
    }

    db.rubrosProgreso[rubroIdx] = {
      ...db.rubrosProgreso[rubroIdx],
      porcentajeAvance: Math.round(porcentajeAvance),
    };
    nuevoAvanceGeneral = recalcularAvanceProyecto(db, proyectoId);
  } else {
    db.proyectos[proyectoIdx] = {
      ...db.proyectos[proyectoIdx],
      avanceProgreso: Math.round(porcentajeAvance),
    };
    nuevoAvanceGeneral = Math.round(porcentajeAvance);
  }

  await writeDb(db);

  return NextResponse.json({
    ok: true,
    nuevoAvanceGeneral,
    resumen: buildProyectoDashboard(db, db.proyectos[proyectoIdx]),
    rubro: rubroId
      ? db.rubrosProgreso.find((r) => r.id === rubroId) ?? null
      : null,
  });
}
