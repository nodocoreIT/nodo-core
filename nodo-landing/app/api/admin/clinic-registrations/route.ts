import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAccountEnabledEmail } from "@/lib/mail";

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

  // Detect completed onboarding by checking professionals/patients tables
  const clinicAdmin = createAdminClient("nodo_clinica");
  const pendingOnboarding = rows.filter(
    (r: { stage: string }) => r.stage === "pending_onboarding",
  );

  const medicoEmails = pendingOnboarding
    .filter((r: { role: string }) => r.role === "medico")
    .map((r: { email: string }) => r.email);
  const pacienteEmails = pendingOnboarding
    .filter((r: { role: string }) => r.role === "paciente")
    .map((r: { email: string }) => r.email);

  const completedEmails = new Set<string>();

  if (medicoEmails.length > 0) {
    const { data: profs } = await clinicAdmin
      .from("professionals")
      .select("email")
      .in("email", medicoEmails);
    (profs ?? []).forEach((r: { email: string }) => completedEmails.add(r.email));
  }

  if (pacienteEmails.length > 0) {
    const { data: patients } = await clinicAdmin
      .from("patients")
      .select("email")
      .in("email", pacienteEmails);
    (patients ?? []).forEach((r: { email: string }) => completedEmails.add(r.email));
  }

  const finalRows = rows.map(
    (r: { stage: string; email: string }) => ({
      ...r,
      stage:
        r.stage === "pending_onboarding" && completedEmails.has(r.email)
          ? "pending_activation"
          : r.stage,
    }),
  );

  return Response.json({ registrations: finalRows });
}

// POST — enable a clinic registration (send password setup email)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();

  if (!id) {
    return Response.json({ error: "id es obligatorio." }, { status: 400 });
  }

  const clinicAdmin = createAdminClient("nodo_clinica");

  // Get the pending registration
  const { data: reg, error: regError } = await clinicAdmin
    .from("pending_clinic_registrations")
    .select("id, email, role")
    .eq("id", id)
    .maybeSingle();

  if (regError || !reg) {
    return Response.json({ error: "Solicitud no encontrada." }, { status: 404 });
  }

  // Check if onboarding was completed — get the name
  const table = reg.role === "medico" ? "professionals" : "patients";
  const { data: profile } = await clinicAdmin
    .from(table)
    .select("full_name, email")
    .eq("email", reg.email)
    .maybeSingle();

  if (!profile) {
    return Response.json(
      { error: "El usuario aún no completó el onboarding." },
      { status: 400 },
    );
  }

  // Generate recovery link for password setup
  const clinicUrl = (
    process.env.NODO_CLINICA_URL ?? "http://localhost:3002"
  ).replace(/\/$/, "");

  const admin = createAdminClient();
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "recovery",
      email: reg.email,
      options: {
        redirectTo: `${clinicUrl}/actualizar-contrasena`,
      },
    });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[admin/clinic-registrations] generateLink error", linkError);
    return Response.json(
      { error: "Error al generar enlace de activación." },
      { status: 500 },
    );
  }

  // Send activation email
  try {
    await sendAccountEnabledEmail({
      nombre: profile.full_name ?? reg.email,
      email: reg.email,
      nodeLabel: "Nodo Clínica",
      loginUrl: linkData.properties.action_link,
    });
  } catch (mailErr) {
    console.error("[admin/clinic-registrations] email error", mailErr);
    return Response.json(
      { error: "Error al enviar email de activación." },
      { status: 500 },
    );
  }

  // Delete the pending registration (cleanup)
  await auth.supabase!.rpc("admin_delete_clinic_registration", { p_id: id });

  return Response.json({ ok: true });
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
