import { NextRequest, NextResponse } from "next/server";
import { writeDb } from "@/lib/clinic/local-db";

export async function GET(request: NextRequest) {
  const appointmentId = new URL(request.url).searchParams.get("appointmentId");
  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId requerido" }, { status: 400 });
  }

  const db = await import("@/lib/clinic/local-db").then((m) => m.readDb());
  const note = db.clinicalNotes[appointmentId];
  return NextResponse.json(note || { content: "" });
}

export async function PUT(request: NextRequest) {
  const { appointmentId, doctorId, content } = await request.json();

  await writeDb((db) => {
    db.clinicalNotes[appointmentId] = {
      appointmentId,
      doctorId,
      content,
      updatedAt: new Date().toISOString(),
    };
  });

  return NextResponse.json({ ok: true });
}
