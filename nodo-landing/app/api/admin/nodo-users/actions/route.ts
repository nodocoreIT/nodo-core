import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { sendRecoveryEmail } from "@/lib/auth/send-recovery-email";
import {
  authAdminForUnitCode,
  ensureAuthUserForUnit,
  resolveAuthUserForUnit,
  MIN_ACCESS_PASSWORD_LENGTH,
} from "@/lib/registration/client-unit-auth";
import { revokeClientUnitAccess } from "@/lib/registration/revoke-client-access";
import {
  isClinicaUnitCode,
  reactivateClinicaPortalAccess,
  softRevokeClinicaPortalAccess,
} from "@/lib/registration/clinica-provision";
import {
  setNodoAuthSuspended,
  setNodoAuthSuspendedForUnit,
} from "@/lib/registration/nodo-access-suspend";
import { syncNodeEmailAccessForClient } from "@/lib/registration/client-unit-auth";
import type { ClientUnitStatus } from "@/lib/registration/types";
import {
  deleteNodoUser,
  previewNodoUserAction,
  revokeNodoUser,
} from "@/lib/panel/nodo-user-lifecycle";
import type { NodoUserRecord } from "@/lib/panel/nodo-users-list";

function asSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type ActionBody = {
  action?: string;
  client_unit_id?: string;
  client_id?: string;
  unit_code?: string;
  auth_user_id?: string;
  email?: string;
  password?: string;
  portal_role?: "medico" | "paciente" | "both";
  clinic_row_id?: string;
  user?: NodoUserRecord;
  confirm_email?: string;
};

export async function POST(request: NextRequest) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as ActionBody;
  const action = String(body.action ?? "").trim();
  const origin = request.headers.get("origin") ?? request.nextUrl.origin;

  if (action === "preview_delete" || action === "preview_revoke") {
    const user = body.user;
    if (!user?.email || !user?.unitCode) {
      return NextResponse.json({ error: "Datos de usuario incompletos." }, { status: 400 });
    }
    const preview = await previewNodoUserAction(
      user,
      action === "preview_delete" ? "delete" : "revoke",
    );
    return NextResponse.json({ preview });
  }

  if (action === "delete") {
    const user = body.user;
    const confirmEmail = String(body.confirm_email ?? "").trim().toLowerCase();
    if (!user?.email || !user?.unitCode) {
      return NextResponse.json({ error: "Datos de usuario incompletos." }, { status: 400 });
    }
    if (confirmEmail !== user.email.trim().toLowerCase()) {
      return NextResponse.json(
        { error: "Escribí el email exacto del usuario para confirmar la eliminación." },
        { status: 400 },
      );
    }
    const result = await deleteNodoUser(user);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "revoke") {
    const user = body.user;
    if (user?.email && user?.unitCode) {
      const result = await revokeNodoUser(user);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    const clientUnitId = String(body.client_unit_id ?? "").trim();
    const unitCode = String(body.unit_code ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const authUserId = String(body.auth_user_id ?? "").trim() || null;
    const portalRole = body.portal_role ?? "both";

    if (clientUnitId) {
      const admin = createAdminClient();
      const { data: unit, error: unitErr } = await admin
        .from("client_units")
        .select("id, unit_code, provision_user_id, access_user, plan")
        .eq("id", clientUnitId)
        .single();

      if (unitErr || !unit) {
        return NextResponse.json({ error: "Unidad no encontrada." }, { status: 404 });
      }

      const result = await revokeClientUnitAccess(unit);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    if (isClinicaUnitCode(unitCode) && email) {
      const role =
        portalRole === "medico" || portalRole === "paciente" ? portalRole : "both";
      const revoked = await softRevokeClinicaPortalAccess({
        email,
        userId: authUserId,
        portalRole: role,
      });
      if (!revoked.ok) {
        return NextResponse.json({ error: revoked.error }, { status: 400 });
      }
      if (authUserId) {
        await setNodoAuthSuspended(unitCode, authUserId, "suspend");
      }
      const landingAdmin = createAdminClient();
      await landingAdmin
        .from("node_email_access")
        .delete()
        .eq("email", email)
        .eq("unit_code", unitCode);
      return NextResponse.json({ ok: true });
    }

    if (unitCode && authUserId) {
      const suspended = await setNodoAuthSuspended(unitCode, authUserId, "suspend");
      if (!suspended.ok) {
        return NextResponse.json({ error: suspended.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Datos insuficientes para revocar acceso." }, { status: 400 });
  }

  if (action === "pause" || action === "reactivate") {
    const clientUnitId = String(body.client_unit_id ?? "").trim();
    if (!clientUnitId) {
      return NextResponse.json({ error: "client_unit_id es obligatorio." }, { status: 400 });
    }

    const admin = createAdminClient();
    const status: ClientUnitStatus = action === "pause" ? "pausado" : "activo";
    const { data: unit, error: unitErr } = await admin
      .from("client_units")
      .select("id, unit_code, status, provision_user_id, access_user, client_id")
      .eq("id", clientUnitId)
      .single();

    if (unitErr || !unit) {
      return NextResponse.json({ error: "Unidad no encontrada." }, { status: 404 });
    }

    if (action === "reactivate" && unit.status !== "pausado") {
      return NextResponse.json({ error: "La unidad no está pausada." }, { status: 400 });
    }
    if (action === "pause" && unit.status === "pausado") {
      return NextResponse.json({ ok: true, status });
    }

    if (action === "reactivate") {
      await setNodoAuthSuspendedForUnit(unit.unit_code, unit, "reactivate");
      if (isClinicaUnitCode(unit.unit_code) && unit.access_user) {
        const authAdmin = authAdminForUnitCode(unit.unit_code);
        const resolved = await resolveAuthUserForUnit(authAdmin, unit);
        const userId = unit.provision_user_id ?? resolved?.userId;
        if (userId) {
          const restored = await reactivateClinicaPortalAccess({
            email: String(unit.access_user).trim().toLowerCase(),
            userId,
            portalRole: "both",
            plan: (unit as { plan?: string | null }).plan ?? null,
          });
          if (!restored.ok) {
            return NextResponse.json({ error: restored.error }, { status: 400 });
          }
        }
      }
    }

    await admin.from("client_units").update({ status }).eq("id", clientUnitId);
    await syncNodeEmailAccessForClient(admin, unit.client_id);

    return NextResponse.json({ ok: true, status });
  }

  if (action === "suspend_auth" || action === "reactivate_auth") {
    const unitCode = String(body.unit_code ?? "").trim();
    const authUserId = String(body.auth_user_id ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const clinicRowId = String(body.clinic_row_id ?? "").trim() || null;
    const portalRole = body.portal_role ?? "both";
    if (!unitCode || !authUserId) {
      return NextResponse.json(
        { error: "unit_code y auth_user_id son obligatorios." },
        { status: 400 },
      );
    }

    const suspendAction = action === "suspend_auth" ? "suspend" : "reactivate";
    const result = await setNodoAuthSuspended(unitCode, authUserId, suspendAction);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (action === "reactivate_auth" && isClinicaUnitCode(unitCode) && email) {
      const restored = await reactivateClinicaPortalAccess({
        email,
        userId: authUserId,
        portalRole: portalRole === "medico" || portalRole === "paciente" ? portalRole : "both",
        clinicRowId,
      });
      if (!restored.ok) {
        return NextResponse.json({ error: restored.error }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "send_password_reset") {
    const unitCode = String(body.unit_code ?? "").trim();
    const email = String(body.email ?? "").trim();
    if (!unitCode || !email) {
      return NextResponse.json({ error: "unit_code y email son obligatorios." }, { status: 400 });
    }

    const result = await sendRecoveryEmail({
      email,
      nodeSlug: unitCode,
      origin,
    });

    if (result.status === "error") {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "set_password") {
    const clientId = String(body.client_id ?? "").trim();
    const unitCode = String(body.unit_code ?? "").trim();
    const password = String(body.password ?? "").trim();

    if (!clientId || !unitCode || !password) {
      return NextResponse.json(
        { error: "client_id, unit_code y password son obligatorios." },
        { status: 400 },
      );
    }
    if (password.length < MIN_ACCESS_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `La contraseña debe tener al menos ${MIN_ACCESS_PASSWORD_LENGTH} caracteres.` },
        { status: 400 },
      );
    }

    const landingAdmin = createAdminClient();
    const { data: unit, error: unitErr } = await landingAdmin
      .from("client_units")
      .select("id, unit_code, access_user, provision_user_id, plan, clients(name)")
      .eq("client_id", clientId)
      .eq("unit_code", unitCode)
      .maybeSingle();

    if (unitErr || !unit) {
      return NextResponse.json({ error: "Nodo contratado no encontrado." }, { status: 404 });
    }
    if (!unit.access_user) {
      return NextResponse.json({ error: "El nodo no tiene email de acceso cargado." }, { status: 400 });
    }

    const authAdmin = authAdminForUnitCode(unit.unit_code);
    if (!authAdmin) {
      return NextResponse.json({ error: `El nodo "${unit.unit_code}" no está configurado.` }, { status: 400 });
    }

    const clientName =
      asSingleRelation(unit.clients as { name?: string } | { name?: string }[] | null)?.name ??
      unit.access_user;

    const ensured = await ensureAuthUserForUnit(authAdmin, {
      unit,
      password,
      mustSetPassword: false,
      unitCode: unit.unit_code,
      clientName,
      plan: unit.plan ?? undefined,
    });

    if (!ensured.ok) {
      return NextResponse.json({ error: ensured.error }, { status: 400 });
    }

    await landingAdmin
      .from("client_units")
      .update({
        access_password: password,
        password_set_at: new Date().toISOString(),
        provision_user_id: ensured.userId,
        provisioned_at: new Date().toISOString(),
      })
      .eq("id", unit.id);

    return NextResponse.json({ ok: true, user_id: ensured.userId });
  }

  if (action === "set_password_direct") {
    const unitCode = String(body.unit_code ?? "").trim();
    const authUserId = String(body.auth_user_id ?? "").trim();
    const password = String(body.password ?? "").trim();

    if (!unitCode || !authUserId || !password) {
      return NextResponse.json(
        { error: "unit_code, auth_user_id y password son obligatorios." },
        { status: 400 },
      );
    }
    if (password.length < MIN_ACCESS_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `La contraseña debe tener al menos ${MIN_ACCESS_PASSWORD_LENGTH} caracteres.` },
        { status: 400 },
      );
    }

    const authAdmin = authAdminForUnitCode(unitCode);
    if (!authAdmin) {
      return NextResponse.json({ error: `El nodo "${unitCode}" no está configurado.` }, { status: 400 });
    }

    const { error } = await authAdmin.auth.admin.updateUserById(authUserId, {
      password,
      app_metadata: { must_set_password: false },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
}
