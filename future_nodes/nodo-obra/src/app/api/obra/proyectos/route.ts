import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, publicCliente } from "@/lib/obra/local-db";
import { buildProyectoDashboard } from "@/lib/obra/stats";
import { getSessionFromRequest, requireStaffSession } from "@/lib/obra/session";

export async function POST(request: NextRequest) {
  const session = await requireStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const db = await readDb();
  const now = new Date().toISOString();
  const proyecto = {
    id: randomUUID(),
    nombre: body.nombre ?? "Nueva obra",
    clienteId: body.clienteId ?? null,
    direccionObra: body.direccionObra ?? "",
    tipoInmueble: body.tipoInmueble ?? "Casa",
    fechaInicio: body.fechaInicio ?? now.slice(0, 10),
    plazoMeses: Number(body.plazoMeses) || 1,
    encargado: body.encargado ?? "",
    porcentajeContingencia: Number(body.porcentajeContingencia) || 10,
    presupuestoEstimado: Number(body.presupuestoEstimado) || 0,
    porcentajeComisionDireccion: Number(body.porcentajeComisionDireccion) || 10,
    tipoHonorario: body.tipoHonorario ?? "PORCENTAJE",
    valorHonorario: Number(body.valorHonorario) || 10,
    estado: body.estado ?? "PLAN",
    notas: body.notas ?? "",
    avanceProgreso: 0,
    origenPresupuestoId: null,
    inmoPropertyId: body.inmoPropertyId ?? null,
    inmoPropertyLabel: body.inmoPropertyLabel ?? null,
    createdAt: now,
  };

  db.proyectos.push(proyecto);
  await writeDb(db);
  return NextResponse.json({ proyecto }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = await readDb();
  let proyectos = db.proyectos;

  if (session.role === "cliente") {
    proyectos = proyectos.filter((p) => p.clienteId === session.userId);
  }

  const obras = proyectos.map((p) => buildProyectoDashboard(db, p));
  const clientes = db.clientes.map(publicCliente);

  return NextResponse.json({ obras, clientes, proyectos });
}
