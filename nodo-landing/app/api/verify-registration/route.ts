import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNodeRegistrationConfig, isSelfServicePlan } from "@/lib/registration/node-config";
import {
  ensureLandingAuthUser,
  provisionNodoAccess,
} from "@/lib/registration/provision";

const ONBOARDING_TTL_HOURS = 72;

type PendingRow = {
  id: string;
  email: string;
  full_name: string;
  plan: string;
  unit_code: string | null;
  password: string | null;
  verified_at: string | null;
  expires_at: string | null;
};

async function redirectForVerifiedUnit(
  request: NextRequest,
  params: {
    clientUnitId: string;
    unitCode: string;
    redirectSlug: string;
    plan: string;
    selfService: boolean;
  },
): Promise<NextResponse> {
  const admin = createAdminClient();
  const { clientUnitId, unitCode, redirectSlug, plan, selfService } = params;

  const { data: unit } = await admin
    .from("client_units")
    .select("status")
    .eq("id", clientUnitId)
    .maybeSingle();

  if (unit?.status === "activo" && selfService) {
    return NextResponse.redirect(
      new URL(
        `/registro/verificado?node=${redirectSlug}${plan === "paciente" ? "&role=paciente" : ""}`,
        request.url,
      ),
    );
  }

  if (unit?.status === "pending_review") {
    return NextResponse.redirect(
      new URL(`/registro/verificado?node=${redirectSlug}&status=pending_review`, request.url),
    );
  }

  if (unit?.status === "activo") {
    return NextResponse.redirect(
      new URL(`/registro/verificado?node=${redirectSlug}&status=existing`, request.url),
    );
  }

  if (!selfService && (unit?.status === "pending_onboarding" || unit?.status === "onboarding")) {
    const { data: existingToken } = await admin
      .from("activation_tokens")
      .select("token, expires_at, used_at")
      .eq("client_unit_id", clientUnitId)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingToken?.token) {
      return NextResponse.redirect(
        new URL(`/onboarding?token=${existingToken.token}`, request.url),
      );
    }

    const expiresAt = new Date(Date.now() + ONBOARDING_TTL_HOURS * 60 * 60 * 1000);
    const { data: tokenRow } = await admin
      .from("activation_tokens")
      .insert({
        client_unit_id: clientUnitId,
        expires_at: expiresAt.toISOString(),
      })
      .select("token")
      .single();

    if (tokenRow?.token) {
      return NextResponse.redirect(new URL(`/onboarding?token=${tokenRow.token}`, request.url));
    }
  }

  return NextResponse.redirect(
    new URL(`/registro/verificado?node=${redirectSlug}&status=existing`, request.url),
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=Token+faltante", request.url));
  }

  const admin = createAdminClient();
  let redirectSlug = "salud";

  try {
    const { data: pending, error: selectErr } = await admin
      .from("pending_registrations")
      .select("*")
      .eq("verification_token", token)
      .maybeSingle();

    if (selectErr || !pending) {
      return NextResponse.redirect(
        new URL(
          "/login?error=Token+de+verificacion+invalido.+Si+ya+verificaste,+inicia+sesion+o+solicita+un+nuevo+correo.",
          request.url,
        ),
      );
    }

    const row = pending as PendingRow;
    const unitCode = row.unit_code ?? "Salud";
    const cfg = getNodeRegistrationConfig(unitCode);
    redirectSlug = cfg?.slug ?? "salud";
    const selfService = isSelfServicePlan(unitCode, row.plan);

    if (row.expires_at && !row.verified_at && new Date(row.expires_at) < new Date()) {
      return NextResponse.redirect(
        new URL(
          `/${redirectSlug}/login?error=El+enlace+de+verificacion+expiro.+Solicita+un+nuevo+correo.&resend=1`,
          request.url,
        ),
      );
    }

    const { data: existingAccess } = await admin
      .from("node_email_access")
      .select("client_unit_id")
      .eq("email", row.email)
      .eq("unit_code", unitCode)
      .maybeSingle();

    if (row.verified_at && existingAccess?.client_unit_id) {
      return redirectForVerifiedUnit(request, {
        clientUnitId: existingAccess.client_unit_id,
        unitCode,
        redirectSlug,
        plan: row.plan,
        selfService,
      });
    }

    const { data: existingClient } = await admin
      .from("clients")
      .select("id")
      .eq("email", row.email)
      .maybeSingle();

    let clientId = existingClient?.id;

    if (!clientId) {
      const { data: newClient, error: clientErr } = await admin
        .from("clients")
        .insert({
          name: row.full_name,
          email: row.email,
          phone: pending.phone ?? null,
        })
        .select("id")
        .single();

      if (clientErr || !newClient) {
        return NextResponse.redirect(
          new URL(`/${redirectSlug}/login?error=Error+al+crear+la+cuenta`, request.url),
        );
      }
      clientId = newClient.id;
    }

    const { data: existingUnit } = await admin
      .from("client_units")
      .select("id, status")
      .eq("client_id", clientId)
      .eq("unit_code", unitCode)
      .maybeSingle();

    if (existingUnit?.status === "pending_review" || existingUnit?.status === "activo") {
      await admin
        .from("pending_registrations")
        .update({ verified_at: row.verified_at ?? new Date().toISOString() })
        .eq("id", row.id);
      return NextResponse.redirect(
        new URL(`/registro/verificado?node=${redirectSlug}&status=existing`, request.url),
      );
    }

    const isPaciente = row.plan === "paciente";
    const unitStatus = selfService ? "activo" : isPaciente ? "pending_review" : "pending_onboarding";
    const unitProgress = selfService ? 100 : isPaciente ? 50 : 0;

    let clientUnitId = existingUnit?.id;

    if (!clientUnitId) {
      const { data: newUnit, error: unitErr } = await admin
        .from("client_units")
        .insert({
          client_id: clientId,
          unit_code: unitCode,
          plan: row.plan,
          status: unitStatus,
          progress: unitProgress,
          access_url: cfg?.accessUrl ?? null,
          access_user: selfService ? row.email : null,
          access_password: selfService ? row.password : null,
        })
        .select("id")
        .single();

      if (unitErr || !newUnit) {
        return NextResponse.redirect(
          new URL(`/${redirectSlug}/login?error=Error+al+vincular+el+nodo`, request.url),
        );
      }
      clientUnitId = newUnit.id;
    } else if (!selfService) {
      await admin
        .from("client_units")
        .update({ status: unitStatus, progress: unitProgress })
        .eq("id", clientUnitId);
    }

    const accessRow = {
      email: row.email,
      unit_code: unitCode,
      client_id: clientId,
      client_unit_id: clientUnitId,
      status: unitStatus,
    };
    const { data: existingAccessRow } = await admin
      .from("node_email_access")
      .select("id")
      .eq("email", row.email)
      .eq("unit_code", unitCode)
      .maybeSingle();

    if (existingAccessRow) {
      await admin.from("node_email_access").update(accessRow).eq("id", existingAccessRow.id);
    } else {
      await admin.from("node_email_access").insert(accessRow);
    }

    if (selfService && row.password) {
      let provisionUserId: string | null = null;

      if (unitCode.toLowerCase() === "finanzas") {
        const provision = await provisionNodoAccess({
          nodoCode: unitCode,
          clientName: row.full_name,
          email: row.email,
          password: row.password,
          plan: row.plan,
        });
        if (!provision.ok || !provision.user_id) {
          console.error("finanzas provision on verify:", provision.error);
          return NextResponse.redirect(
            new URL(
              `/${redirectSlug}/login?error=No+se+pudo+activar+tu+cuenta.+Contacta+soporte.`,
              request.url,
            ),
          );
        }
        provisionUserId = provision.user_id;
      } else {
        const userRole =
          row.plan === "paciente" ? "paciente" : row.plan === "inmo" ? "inmo" : "medico";

        provisionUserId = await ensureLandingAuthUser(
          admin,
          row.email,
          row.password,
          row.full_name,
          userRole,
        );
      }

      if (provisionUserId && clientUnitId) {
        await admin
          .from("client_units")
          .update({
            provision_user_id: provisionUserId,
            provisioned_at: new Date().toISOString(),
          })
          .eq("id", clientUnitId);
      }
    }

    await admin
      .from("pending_registrations")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", row.id);

    if (selfService) {
      return NextResponse.redirect(
        new URL(
          `/registro/verificado?node=${redirectSlug}${row.plan === "paciente" ? "&role=paciente" : ""}`,
          request.url,
        ),
      );
    }

    // Patients skip onboarding — go straight to pending_review confirmation
    if (row.plan === "paciente") {
      return NextResponse.redirect(
        new URL(`/registro/verificado?node=${redirectSlug}&status=pending_review&role=paciente`, request.url),
      );
    }

    const expiresAt = new Date(Date.now() + ONBOARDING_TTL_HOURS * 60 * 60 * 1000);
    const { data: tokenRow, error: tokenErr } = await admin
      .from("activation_tokens")
      .insert({
        client_unit_id: clientUnitId,
        expires_at: expiresAt.toISOString(),
      })
      .select("token")
      .single();

    if (tokenErr || !tokenRow) {
      return NextResponse.redirect(
        new URL(`/${redirectSlug}/login?error=Error+al+generar+onboarding`, request.url),
      );
    }

    return NextResponse.redirect(new URL(`/onboarding?token=${tokenRow.token}`, request.url));
  } catch (err) {
    console.error("verify-registration:", err);
    return NextResponse.redirect(
      new URL(`/${redirectSlug}/login?error=Error+interno+al+verificar+cuenta`, request.url),
    );
  }
}
