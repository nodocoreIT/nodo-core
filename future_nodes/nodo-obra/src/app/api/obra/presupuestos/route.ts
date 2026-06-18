import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, publicCliente } from "@/lib/obra/local-db";
import { buildPresupuestoResumen } from "@/lib/obra/presupuestos";
import { requireStaffSession } from "@/lib/obra/session";
import type { LocalPresupuesto, PresupuestoRubroLine } from "@/lib/obra/types";

function parseRubros(raw: unknown): PresupuestoRubroLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((line) => ({
    id: String((line as PresupuestoRubroLine).id ?? randomUUID()),
    rubroNombre: String((line as PresupuestoRubroLine).rubroNombre ?? "").trim(),
    manoObra: Number((line as PresupuestoRubroLine).manoObra) || 0,
    materiales: Number((line as PresupuestoRubroLine).materiales) || 0,
    notas: String((line as PresupuestoRubroLine).notas ?? ""),
  })).filter((r) => r.rubroNombre);
}

export async function GET(request: NextRequest) {
  const session = await requireStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = await readDb();
  const presupuestos = db.presupuestos
    .map((p) => buildPresupuestoResumen(db, p))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return NextResponse.json({
    presupuestos,
    items: db.presupuestos,
    clientes: db.clientes.map(publicCliente),
    rubrosCatalogo: db.rubros.map((r) => r.nombre),
  });
}

export async function POST(request: NextRequest) {
  const session = await requireStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const titulo = String(body.titulo ?? "").trim();
  if (!titulo) {
    return NextResponse.json({ error: "Título requerido" }, { status: 400 });
  }

  const rubros = parseRubros(body.rubros);
  if (rubros.length === 0) {
    return NextResponse.json(
      { error: "Agregá al menos un rubro" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const presupuesto: LocalPresupuesto = {
    id: randomUUID(),
    titulo,
    clienteId: body.clienteId ?? null,
    direccionObra: String(body.direccionObra ?? ""),
    tipoInmueble: String(body.tipoInmueble ?? "Casa"),
    plazoMeses: Number(body.plazoMeses) || 1,
    encargado: String(body.encargado ?? ""),
    porcentajeContingencia: Number(body.porcentajeContingencia) || 10,
    notas: String(body.notas ?? ""),
    estado: body.estado === "ENVIADO" ? "ENVIADO" : "BORRADOR",
    proyectoId: null,
    inmoPropertyId: body.inmoPropertyId ?? null,
    inmoPropertyLabel: body.inmoPropertyLabel ?? null,
    createdAt: now,
    updatedAt: now,
    aprobadoAt: null,
    rubros,
  };

  const db = await readDb();
  db.presupuestos.push(presupuesto);
  await writeDb(db);

  return NextResponse.json(
    {
      presupuesto,
      resumen: buildPresupuestoResumen(db, presupuesto),
    },
    { status: 201 },
  );
}
