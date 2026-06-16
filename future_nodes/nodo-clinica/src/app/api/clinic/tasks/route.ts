import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, newId } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const due = new URL(request.url).searchParams.get("due");
  const db = await readDb();
  let tasks = (db.doctorTasks ?? []).filter((t) => t.doctorId === session.userId);

  if (due) {
    tasks = tasks.filter((t) => t.dueDate === due);
  }

  return NextResponse.json({
    tasks: tasks.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Título requerido" }, { status: 400 });
  }

  const task = {
    id: newId("task"),
    doctorId: session.userId,
    title,
    dueDate: body.dueDate ? String(body.dueDate) : undefined,
    done: false,
    createdAt: new Date().toISOString(),
  };

  await writeDb((db) => {
    if (!db.doctorTasks) db.doctorTasks = [];
    db.doctorTasks.push(task);
  });

  return NextResponse.json({ task });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const taskId = String(body.id ?? "");
  if (!taskId) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  let updated = false;
  await writeDb((db) => {
    const task = db.doctorTasks?.find(
      (t) => t.id === taskId && t.doctorId === session.userId,
    );
    if (!task) return;
    if (body.title !== undefined) task.title = String(body.title).trim();
    if (body.dueDate !== undefined) task.dueDate = body.dueDate || undefined;
    if (body.done !== undefined) task.done = !!body.done;
    updated = true;
  });

  if (!updated) {
    return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const taskId = new URL(request.url).searchParams.get("id");
  if (!taskId) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  await writeDb((db) => {
    db.doctorTasks = (db.doctorTasks ?? []).filter(
      (t) => !(t.id === taskId && t.doctorId === session.userId),
    );
  });

  return NextResponse.json({ ok: true });
}
