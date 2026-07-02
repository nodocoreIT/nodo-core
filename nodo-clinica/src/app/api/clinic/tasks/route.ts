import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  if (user.role === "patient") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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
  const { user, supabase } = auth;

  if (user.role === "patient") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("professionals")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Título requerido" }, { status: 400 });
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
  const { user, supabase } = auth;

  if (user.role === "patient") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("professionals")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const taskId = String(body.id ?? "");
  if (!taskId) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
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
  const { user, supabase } = auth;

  if (user.role === "patient") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("professionals")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const taskId = new URL(request.url).searchParams.get("id");
  if (!taskId) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  await supabase
    .from("doctor_tasks")
    .delete()
    .eq("id", taskId)
    .eq("professional_id", me.id);

  return NextResponse.json({ ok: true });
}
