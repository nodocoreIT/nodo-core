import { NextRequest, NextResponse } from "next/server";
import { readJwtAppMetadata } from "@/lib/nodo/jwt-claims";
import { createClient } from "@/lib/supabase/server";
import {
  readDb,
  writeDb,
  newId,
  publicDoctor,
} from "@/lib/clinic/local-db";
import { jsonWithSession, type ClinicSession } from "@/lib/clinic/session";
import { isLocalMode } from "@/lib/clinic/config";
import { forbidden, unauthorized } from "@/lib/clinic/access-control";

const ORG_DOCTOR_ROLES = new Set(["super_admin", "admin", "medico", "agent"]);

/**
 * Tras login Supabase (médico provisionado desde nodocore.com.ar),
 * vincula la sesión de plataforma con el doctor en local-db para las APIs clínicas.
 */
export async function POST(_request: NextRequest) {
  if (isLocalMode()) {
    return NextResponse.json(
      { error: "Platform sync no aplica en modo local" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user?.email) {
    return unauthorized("Iniciá sesión con tu cuenta Nodo");
  }

  const meta = readJwtAppMetadata(session);
  const orgId = typeof meta.org_id === "string" ? meta.org_id : undefined;
  const jwtRole = typeof meta.role === "string" ? meta.role : "";
  const plan =
    typeof meta.plan === "string" ? meta.plan : ("starter" as const);

  if (!ORG_DOCTOR_ROLES.has(jwtRole)) {
    return forbidden(
      "Tu cuenta no tiene rol de médico en Nodo Clínica. Usá el portal de pacientes.",
    );
  }

  const email = session.user.email.toLowerCase().trim();
  const metaName = session.user.user_metadata?.full_name;
  const displayName =
    (typeof metaName === "string" && metaName.trim()) ||
    email.split("@")[0] ||
    "Médico";

  const db = await readDb();
  let doctor =
    db.doctors.find((d) => d.supabaseUserId === session.user.id) ??
    db.doctors.find((d) => d.email === email) ??
    (orgId ? db.doctors.find((d) => d.orgId === orgId) : undefined);

  if (!doctor) {
    doctor = {
      id: newId("doc"),
      fullName: displayName,
      email,
      password: "",
      specialty: "Medicina General",
      licenseNumber: "Pendiente",
      subscriptionStatus: "active",
      subscriptionPlan: plan,
      orgId,
      supabaseUserId: session.user.id,
      createdAt: new Date().toISOString(),
    };
    await writeDb((d) => {
      d.doctors.push(doctor!);
    });
  } else {
    await writeDb((d) => {
      const target = d.doctors.find((x) => x.id === doctor!.id);
      if (!target) return;
      if (displayName && target.fullName === "Médico") {
        target.fullName = displayName;
      }
      target.subscriptionPlan = plan;
      target.subscriptionStatus = "active";
      if (orgId) target.orgId = orgId;
      target.supabaseUserId = session.user.id;
    });
    doctor = (await readDb()).doctors.find((d) => d.id === doctor!.id)!;
  }

  const clinicSession: ClinicSession = {
    userId: doctor.id,
    role: "doctor",
    email: doctor.email,
    fullName: doctor.fullName,
  };

  return jsonWithSession(
    {
      user: publicDoctor(doctor),
      role: "doctor",
      session: clinicSession,
      platform: { orgId, plan, jwtRole },
    },
    clinicSession,
  );
}
