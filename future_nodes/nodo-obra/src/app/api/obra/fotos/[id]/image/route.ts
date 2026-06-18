import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/obra/local-db";
import { readFotoAvanceFile } from "@/lib/obra/fotos-storage";
import { getSessionFromRequest } from "@/lib/obra/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const db = await readDb();
  const foto = db.fotosAvance.find((f) => f.id === id);
  if (!foto) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  if (session.role === "cliente") {
    const proyecto = db.proyectos.find((p) => p.id === foto.proyectoId);
    if (!proyecto || proyecto.clienteId !== session.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  try {
    const { buffer, contentType } = await readFotoAvanceFile(
      foto.proyectoId,
      foto.fileName,
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }
}
