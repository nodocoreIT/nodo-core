import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { isLocalMode } from "@/lib/clinic/config";
import { readDb, writeDb } from "@/lib/clinic/local-db";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
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

    const due = new URL(request.url).searchParams.get("due");
    const db = await readDb();
    let tasks = (db.doctorTasks ?? []).filter((t) => t.doctorId === me.id);
    if (due) tasks = tasks.filter((t) => t.dueDate === due);
    tasks.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return NextResponse.json({ tasks });
  }

  const { user, supabase } = auth;

  const { data: me } = await supabase
    .from("professionals")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const due = new URL(request.url).searchParams.get("due");

  let query = supabase
    .from("doctor_tasks")
    .select("*")
    .eq("professional_id", me.id)
    .order("created_at", { ascending: false });

  if (due) {
    query = query.eq("due_date", due);
  }

  const { data: tasks, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Error al obtener tareas" }, { status: 500 });
  }

  return NextResponse.json({
    tasks: (tasks ?? []).map((t) => ({
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
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.user.role === "patient") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Título requerido" }, { status: 400 });
  }

  if (isLocalMode()) {
    const me = await resolveProfessional(auth);
    if (!me) {
      return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
    }

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

  const { user, supabase } = auth;

  const { data: me } = await supabase
    .from("professionals")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const { data: task, error } = await supabase
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
    .single();

  if (error) {
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
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.user.role === "patient") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const taskId = String(body.id ?? "");
  if (!taskId) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  if (isLocalMode()) {
    const me = await resolveProfessional(auth);
    if (!me) {
      return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
    }

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

  const { user, supabase } = auth;

  const { data: me } = await supabase
    .from("professionals")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = String(body.title).trim();
  if (body.dueDate !== undefined) updates.due_date = body.dueDate || null;
  if (body.done !== undefined) updates.done = !!body.done;

  const { data: updated, error } = await supabase
    .from("doctor_tasks")
    .update(updates)
    .eq("id", taskId)
    .eq("professional_id", me.id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.user.role === "patient") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const taskId = new URL(request.url).searchParams.get("id");
  if (!taskId) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  if (isLocalMode()) {
    const me = await resolveProfessional(auth);
    if (!me) {
      return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
    }

    await writeDb((db) => {
      db.doctorTasks = (db.doctorTasks ?? []).filter(
        (t) => !(t.id === taskId && t.doctorId === me.id),
      );
    });

    return NextResponse.json({ ok: true });
  }

  const { user, supabase } = auth;

  const { data: me } = await supabase
    .from("professionals")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  await supabase
    .from("doctor_tasks")
    .delete()
    .eq("id", taskId)
    .eq("professional_id", me.id);

  return NextResponse.json({ ok: true });
}
