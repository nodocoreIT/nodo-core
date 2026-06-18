import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/obra/local-db";
import { requireStaffSession } from "@/lib/obra/session";

export async function POST(request: NextRequest) {
  const session = await requireStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const proyectoId = body.proyectoId as string;
  const detalle = String(body.detalle ?? "").trim();
  const montoTicket = Number(body.montoTicket);

  if (!proyectoId || !detalle || !montoTicket || montoTicket <= 0) {
    return NextResponse.json(
      { error: "Obra, detalle y monto válido requeridos" },
      { status: 400 },
    );
  }

  const db = await readDb();
  if (!db.proyectos.some((p) => p.id === proyectoId)) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
  }

  const gasto = {
    id: randomUUID(),
    proyectoId,
    rubroId: body.rubroId ?? null,
    fecha: body.fecha ?? new Date().toISOString().slice(0, 10),
    detalle,
    montoTicket,
    tipoComponente:
      body.tipoComponente === "MANO_OBRA" ? ("MANO_OBRA" as const) : ("MATERIALES" as const),
  };

  db.gastos.push(gasto);
  await writeDb(db);
  return NextResponse.json({ gasto }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await requireStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const proyectoId = request.nextUrl.searchParams.get("proyectoId");
  if (!proyectoId) {
    return NextResponse.json({ error: "proyectoId requerido" }, { status: 400 });
  }

  const db = await readDb();
  const gastos = db.gastos
    .filter((g) => g.proyectoId === proyectoId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const rubros = db.rubros;

  return NextResponse.json({ gastos, rubros });
}
