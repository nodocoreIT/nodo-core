import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, publicCliente } from "@/lib/obra/local-db";
import { buildPresupuestoResumen } from "@/lib/obra/presupuestos";
import { requireStaffSession } from "@/lib/obra/session";
import type { PresupuestoEstado, PresupuestoRubroLine } from "@/lib/obra/types";

function parseRubros(raw: unknown): PresupuestoRubroLine[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .map((line) => ({
      id: String((line as PresupuestoRubroLine).id ?? randomUUID()),
      rubroNombre: String((line as PresupuestoRubroLine).rubroNombre ?? "").trim(),
      manoObra: Number((line as PresupuestoRubroLine).manoObra) || 0,
      materiales: Number((line as PresupuestoRubroLine).materiales) || 0,
      notas: String((line as PresupuestoRubroLine).notas ?? ""),
    }))
    .filter((r) => r.rubroNombre);
}

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
  const presupuesto = db.presupuestos.find((p) => p.id === id);
  if (!presupuesto) {
    return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  }

  const cliente = presupuesto.clienteId
    ? db.clientes.find((c) => c.id === presupuesto.clienteId) ?? null
    : null;

  return NextResponse.json({
    presupuesto,
    resumen: buildPresupuestoResumen(db, presupuesto),
    cliente: cliente ? publicCliente(cliente) : null,
    rubrosCatalogo: db.rubros.map((r) => r.nombre),
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
  const idx = db.presupuestos.findIndex((p) => p.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  }

  const current = db.presupuestos[idx];
  if (current.estado === "CONVERTIDO") {
    return NextResponse.json(
      { error: "No se puede editar un presupuesto ya convertido" },
      { status: 400 },
    );
  }

  const rubrosParsed = parseRubros(body.rubros);
  const now = new Date().toISOString();
  const nextEstado = body.estado as PresupuestoEstado | undefined;

  db.presupuestos[idx] = {
    ...current,
    titulo: body.titulo !== undefined ? String(body.titulo).trim() : current.titulo,
    clienteId:
      body.clienteId !== undefined ? body.clienteId ?? null : current.clienteId,
    direccionObra:
      body.direccionObra !== undefined
        ? String(body.direccionObra)
        : current.direccionObra,
    tipoInmueble:
      body.tipoInmueble !== undefined
        ? String(body.tipoInmueble)
        : current.tipoInmueble,
    plazoMeses:
      body.plazoMeses !== undefined
        ? Number(body.plazoMeses) || 1
        : current.plazoMeses,
    encargado:
      body.encargado !== undefined ? String(body.encargado) : current.encargado,
    porcentajeContingencia:
      body.porcentajeContingencia !== undefined
        ? Number(body.porcentajeContingencia) || 0
        : current.porcentajeContingencia,
    notas: body.notas !== undefined ? String(body.notas) : current.notas,
    inmoPropertyId:
      body.inmoPropertyId !== undefined
        ? body.inmoPropertyId ?? null
        : current.inmoPropertyId,
    inmoPropertyLabel:
      body.inmoPropertyLabel !== undefined
        ? body.inmoPropertyLabel ?? null
        : current.inmoPropertyLabel,
    rubros: rubrosParsed ?? current.rubros,
    estado: nextEstado ?? current.estado,
    updatedAt: now,
    aprobadoAt:
      nextEstado === "APROBADO" ? now : current.aprobadoAt,
  };

  await writeDb(db);
  return NextResponse.json({
    presupuesto: db.presupuestos[idx],
    resumen: buildPresupuestoResumen(db, db.presupuestos[idx]),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const db = await readDb();
  const presupuesto = db.presupuestos.find((p) => p.id === id);
  if (!presupuesto) {
    return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  }
  if (presupuesto.estado === "CONVERTIDO") {
    return NextResponse.json(
      { error: "No se puede eliminar un presupuesto convertido" },
      { status: 400 },
    );
  }

  db.presupuestos = db.presupuestos.filter((p) => p.id !== id);
  await writeDb(db);
  return NextResponse.json({ ok: true });
}
