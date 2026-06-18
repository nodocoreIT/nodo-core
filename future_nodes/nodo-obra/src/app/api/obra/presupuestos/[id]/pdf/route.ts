import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/obra/local-db";
import { buildPresupuestoResumen } from "@/lib/obra/presupuestos";
import { presupuestoPdfBuffer } from "@/lib/obra/pdf/presupuesto-pdf";
import { getSessionFromRequest, requireStaffSession } from "@/lib/obra/session";

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
  const presupuesto = db.presupuestos.find((p) => p.id === id);
  if (!presupuesto) {
    return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  }

  if (session.role === "cliente") {
    if (presupuesto.clienteId !== session.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    if (presupuesto.estado === "BORRADOR") {
      return NextResponse.json({ error: "Presupuesto no disponible" }, { status: 403 });
    }
  } else {
    const staff = await requireStaffSession(request);
    if (!staff) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const resumen = buildPresupuestoResumen(db, presupuesto);
  const pdf = presupuestoPdfBuffer({
    presupuesto,
    clienteNombre: resumen.clienteNombre,
    encargadoNombre: presupuesto.encargado,
  });

  const filename = `presupuesto-${presupuesto.titulo.replace(/[^\w\s-]/g, "").slice(0, 40)}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
