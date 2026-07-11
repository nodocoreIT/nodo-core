import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: Response.json({ error: "No autorizado." }, { status: 401 }) };
  }

  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (caller?.role !== "admin") {
    return { error: Response.json({ error: "Solo administradores." }, { status: 403 }) };
  }

  return { supabase };
}

// GET — list all clinic pending registrations with stage info
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase!.rpc(
    "admin_get_clinic_registrations",
  );

  if (error) {
    console.error("[admin/clinic-registrations] GET error", error);
    return Response.json({ error: "Error al cargar solicitudes." }, { status: 500 });
  }

  const now = new Date();
  const rows = (data ?? []).map(
    (row: {
      id: string;
      email: string;
      role: string;
      verified_at: string | null;
      onboarding_token: string | null;
      expires_at: string;
      created_at: string;
    }) => {
      let stage: "pending_email" | "expired" | "pending_onboarding";
      if (row.verified_at) {
        stage = "pending_onboarding";
      } else if (new Date(row.expires_at) < now) {
        stage = "expired";
      } else {
        stage = "pending_email";
      }
      return { ...row, stage };
    },
  );

  return Response.json({ registrations: rows });
}

// DELETE — remove a pending registration so the user can re-register
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();

  if (!id) {
    return Response.json({ error: "id es obligatorio." }, { status: 400 });
  }

  const { error } = await auth.supabase!.rpc(
    "admin_delete_clinic_registration",
    { p_id: id },
  );

  if (error) {
    console.error("[admin/clinic-registrations] DELETE error", error);
    return Response.json({ error: "Error al eliminar solicitud." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
