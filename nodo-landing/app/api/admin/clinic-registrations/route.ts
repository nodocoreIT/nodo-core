import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
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

  // Generate recovery link for password setup using nodo-clínica's own Supabase project.
  // Redirect directly to the clinica app — no nodo-landing intermediary needed.
  // Supabase handles the token exchange and appends #access_token=...&type=recovery.
  const clinicaAppUrl = (process.env.NODO_CLINICA_APP_URL ?? "https://clinica.nodocore.com.ar").replace(/\/$/, "");
  const redirectToUrl = `${clinicaAppUrl}/actualizar-contrasena?role=${reg.role}`;

  const nodoAdmin = createNodoAdminClient("clinica");
  if (!nodoAdmin) {
    return Response.json({ error: "Nodo Clínica no está configurado (NODO_CLINICA_SUPABASE_URL / SERVICE_ROLE_KEY)." }, { status: 500 });
  }
  const { data: linkData, error: linkError } =
    await nodoAdmin.auth.admin.generateLink({
      type: "recovery",
      email: reg.email,
      options: { redirectTo: redirectToUrl },
    });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[admin/clinic-registrations] generateLink error", linkError);
    return Response.json(
      { error: "Error al generar enlace de activación." },
      { status: 500 },
    );
  }

  // Set app_metadata.role so getSession() returns the correct role after login.
  // Users created via the verify flow have no role in app_metadata — without this
  // they land in the patient portal and get kicked out of /medico/dashboard.
  const authUserId = linkData.user?.id;
  if (authUserId) {
    await nodoAdmin.auth.admin.updateUserById(authUserId, {
      app_metadata: { role: reg.role }, // "medico" or "paciente"
    });
  }

  // Send activation email
  try {
    await sendAccountEnabledEmail({
      nombre: profile.full_name ?? reg.email,
      email: reg.email,
      nodeLabel: "Nodo Clínica",
      loginUrl: linkData.properties.action_link,
      unitCode: "clinica",
    });
  } catch (mailErr) {
    console.error("[admin/clinic-registrations] email error", mailErr);
    return Response.json(
      { error: "Error al enviar email de activación." },
      { status: 500 },
    );
  }

  // Ensure the user has a client record + "Clínica" unit in the landing DB
  // so the badge "nodo | Clínica" appears in the admin panel.
  const landingSb = auth.supabase!;
  const { data: existingClient } = await landingSb
    .from("clients")
    .select("id")
    .eq("email", reg.email)
    .maybeSingle();

  let clientId = existingClient?.id ?? null;

  if (!clientId) {
    const { data: newClient } = await landingSb
      .from("clients")
      .insert({ name: profile.full_name ?? reg.email, email: reg.email })
      .select("id")
      .single();
    clientId = newClient?.id ?? null;
  }

  if (clientId) {
    // Check if a Clínica unit already exists to avoid duplicates
    const { data: existingUnit } = await landingSb
      .from("client_units")
      .select("id")
      .eq("client_id", clientId)
      .eq("unit_code", "Clínica")
      .maybeSingle();

    if (!existingUnit) {
      const clinicaUrl = (process.env.NODO_CLINICA_APP_URL ?? "https://clinica.nodocore.com.ar").replace(/\/$/, "");
      await landingSb.from("client_units").insert({
        client_id: clientId,
        unit_code: "Clínica",
        plan: reg.role === "medico" ? "profesional" : "paciente",
        status: "activo",
        progress: 100,
        access_url: clinicaUrl,
        access_user: reg.email,
      });
    }
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
