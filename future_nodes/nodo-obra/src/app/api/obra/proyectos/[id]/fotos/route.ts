import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, getProyectoById } from "@/lib/obra/local-db";
import { saveFotoAvance } from "@/lib/obra/fotos-storage";
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
  if (!getProyectoById(db, id)) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
  }

  const fotos = db.fotosAvance
    .filter((f) => f.proyectoId === id)
    .sort((a, b) => b.fechaAvance.localeCompare(a.fechaAvance));

  return NextResponse.json({ fotos });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: proyectoId } = await params;
  const db = await readDb();
  if (!getProyectoById(db, proyectoId)) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("imagen");
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const fechaAvance = String(formData.get("fecha") ?? new Date().toISOString().slice(0, 10));

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Imagen requerida" }, { status: 400 });
  }
  if (!descripcion) {
    return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
  }

  try {
    const foto = await saveFotoAvance(proyectoId, file, descripcion, fechaAvance);
    db.fotosAvance.push(foto);
    await writeDb(db);
    return NextResponse.json({ foto }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo guardar" },
      { status: 400 },
    );
  }
}
