import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/obra/local-db";
import { deleteFotoAvanceFile } from "@/lib/obra/fotos-storage";
import { requireStaffSession } from "@/lib/obra/session";

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
  const foto = db.fotosAvance.find((f) => f.id === id);
  if (!foto) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  db.fotosAvance = db.fotosAvance.filter((f) => f.id !== id);
  await writeDb(db);
  await deleteFotoAvanceFile(foto.proyectoId, foto.fileName);

  return NextResponse.json({ ok: true });
}
