import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/obra/local-db";
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
  const before = db.gastos.length;
  db.gastos = db.gastos.filter((g) => g.id !== id);

  if (db.gastos.length === before) {
    return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
  }

  await writeDb(db);
  return NextResponse.json({ ok: true });
}
