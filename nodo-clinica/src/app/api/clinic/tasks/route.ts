import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { isLocalMode } from "@/lib/clinic/config";
import { readDb, writeDb } from "@/lib/clinic/local-db";
import { createServiceClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

async function resolveDoctor(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.user.role === "patient") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (isLocalMode()) {
    const me = await resolveProfessional(auth);
    if (!me) {
      return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
    }
    return { me, auth, local: true as const };
  }

  const me = await resolveProfessional(auth);
  if (!me) {
    return { error: NextResponse.json({ error: "Médico no encontrado" }, { status: 404 }) };
  }

  return { me, auth, local: false as const };
}

export async function GET(request: NextRequest) {
  const resolved = await resolveDoctor(request);
  if (resolved instanceof NextResponse) return resolved;
  if ("error" in resolved) return resolved.error;
  const { me } = resolved;

  const due = new URL(request.url).searchParams.get("due");

  if (isLocalMode()) {
    const db = await readDb();
    let tasks = (db.doctorTasks ?? []).filter((t) => t.doctorId === me.id);
    if (due) tasks = tasks.filter((t) => t.dueDate === due);
    tasks.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return NextResponse.json({ tasks });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;

  let query = svc
    .from("doctor_tasks")
    .select("*")
    .eq("professional_id", me.id)
    .order("created_at", { ascending: false });

  if (due) query = query.eq("due_date", due);

  const { data: tasks, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Error al obtener tareas" }, { status: 500 });
  }

  return NextResponse.json({
    tasks: (tasks ?? []).map((t: Record<string, unknown>) => ({
      id: t.id,
      doctorId: t.professional_id,
      title: t.title,
      dueDate: t.due_date,
      done: t.done,
      createdAt: t.created_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const resolved = await resolveDoctor(request);
  if (resolved instanceof NextResponse) return resolved;
  if ("error" in resolved) return resolved.error;
  const { me } = resolved;

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Título requerido" }, { status: 400 });
  }

  if (isLocalMode()) {
    const task = {
      id: randomUUID(),
      doctorId: me.id,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;
  const { data: task, error } = await svc
    .from("doctor_tasks")
    .insert({
      id: randomUUID(),
      professional_id: me.id,
      title,
      due_date: body.dueDate ? String(body.dueDate) : null,
      done: false,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();

  if (error || !task) {
    return NextResponse.json({ error: "Error al crear tarea" }, { status: 500 });
  }

  return NextResponse.json({
    task: {
      id: task.id,
      doctorId: task.professional_id,
      title: task.title,
      dueDate: task.due_date,
      done: task.done,
      createdAt: task.created_at,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const resolved = await resolveDoctor(request);
  if (resolved instanceof NextResponse) return resolved;
  if ("error" in resolved) return resolved.error;
  const { me } = resolved;

  const body = await request.json();
  const taskId = String(body.id ?? "");
  if (!taskId) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  if (isLocalMode()) {
    let found = false;
    await writeDb((db) => {
      const task = (db.doctorTasks ?? []).find(
        (t) => t.id === taskId && t.doctorId === me.id,
      );
      if (!task) return;
      found = true;
      if (body.title !== undefined) task.title = String(body.title).trim();
      if (body.dueDate !== undefined) {
        task.dueDate = body.dueDate ? String(body.dueDate) : undefined;
      }
      if (body.done !== undefined) task.done = !!body.done;
    });

    if (!found) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = String(body.title).trim();
  if (body.dueDate !== undefined) updates.due_date = body.dueDate || null;
  if (body.done !== undefined) updates.done = !!body.done;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;
  const { data: updated, error } = await svc
    .from("doctor_tasks")
    .update(updates)
    .eq("id", taskId)
    .eq("professional_id", me.id)
    .select()
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const resolved = await resolveDoctor(request);
  if (resolved instanceof NextResponse) return resolved;
  if ("error" in resolved) return resolved.error;
  const { me } = resolved;

  const taskId = new URL(request.url).searchParams.get("id");
  if (!taskId) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  if (isLocalMode()) {
    await writeDb((db) => {
      db.doctorTasks = (db.doctorTasks ?? []).filter(
        (t) => !(t.id === taskId && t.doctorId === me.id),
      );
    });

    return NextResponse.json({ ok: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;
  await svc
    .from("doctor_tasks")
    .delete()
    .eq("id", taskId)
    .eq("professional_id", me.id);

  return NextResponse.json({ ok: true });
}
