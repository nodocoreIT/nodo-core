import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

async function resolveDoctor(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return { error: auth };

  if (auth.user.role === "patient") {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  const me = await resolveProfessional(auth);
  if (!me) {
    return { error: NextResponse.json({ error: "Médico no encontrado" }, { status: 404 }) };
  }

  return { me };
}

export async function GET(request: NextRequest) {
  const resolved = await resolveDoctor(request);
  if (resolved.error) return resolved.error;
  const { me } = resolved;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;
  const due = new URL(request.url).searchParams.get("due");

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
  if (resolved.error) return resolved.error;
  const { me } = resolved;

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Título requerido" }, { status: 400 });
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
  if (resolved.error) return resolved.error;
  const { me } = resolved;

  const body = await request.json();
  const taskId = String(body.id ?? "");
  if (!taskId) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
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
  if (resolved.error) return resolved.error;
  const { me } = resolved;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;
  const taskId = new URL(request.url).searchParams.get("id");
  if (!taskId) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  await svc
    .from("doctor_tasks")
    .delete()
    .eq("id", taskId)
    .eq("professional_id", me.id);

  return NextResponse.json({ ok: true });
}
