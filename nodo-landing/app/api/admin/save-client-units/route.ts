import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { revokeClientUnitAccess } from "@/lib/registration/revoke-client-access";
import { syncNodeEmailAccessForClient } from "@/lib/registration/client-unit-auth";
import { provisionNodoAccess, provisionNodoAccessPendingPassword } from "@/lib/registration/provision";
import { sendActivationEmail, sendNodeLinkedEmail, isMailConfigured } from "@/lib/mail";
import { NODES } from "@/lib/nodes";

type UnitPayload = {
  unit_code: string;
  plan: string | null;
  status: string;
  progress: number;
  access_url: string | null;
  access_user: string | null;
  access_password: string | null;
  provisioned_at: string | null;
  provision_user_id: string | null;
};

export async function POST(request: NextRequest) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const origin = request.headers.get("origin") ?? request.nextUrl.origin;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          "Falta SUPABASE_SERVICE_ROLE_KEY en el entorno. Verificá .env.local y reiniciá el servidor.",
      },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const clientId = String(body.client_id ?? "").trim();
  const clientName = String(body.client_name ?? "").trim();
  const runProvision = body.provision === true;
  const units = Array.isArray(body.units) ? (body.units as UnitPayload[]) : [];

  if (!clientId) {
    return NextResponse.json({ error: "client_id es obligatorio." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existingUnits, error: fetchErr } = await admin
    .from("client_units")
    .select("id, unit_code, provision_user_id, access_user, plan")
    .eq("client_id", clientId);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 400 });
  }

  const rows = units.map((u) => ({
    client_id: clientId,
    unit_code: String(u.unit_code ?? "").trim(),
    plan: u.plan?.trim() || null,
    status: String(u.status ?? "activo").trim(),
    progress: Math.max(0, Math.min(100, Number(u.progress) || 0)),
    access_url: u.access_url?.trim() || null,
    access_user: u.access_user?.trim() || null,
    access_password: u.access_password?.trim() || null,
    provisioned_at: u.provisioned_at || null,
    provision_user_id: u.provision_user_id || null,
  }));

  const invalid = rows.find((r) => !r.unit_code);
  if (invalid) {
    return NextResponse.json({ error: "Cada nodo necesita un unit_code válido." }, { status: 400 });
  }

  // Diff against existing rows instead of delete-all + insert-all — a blanket
  // replace reset created_at (and any other DB-defaulted metadata) for every
  // unit on every save, even ones the admin didn't touch. Confirmed in prod:
  // editing one unit on a 4-unit client reset all 4 client_units.created_at
  // to the same save timestamp, destroying their real "Alta" dates.
  const existingByCode = new Map((existingUnits ?? []).map((u) => [u.unit_code, u]));
  const nextCodes = new Set(rows.map((r) => r.unit_code));

  for (const prev of existingUnits ?? []) {
    if (!nextCodes.has(prev.unit_code)) {
      await revokeClientUnitAccess(prev);
      continue;
    }
    const next = rows.find((r) => r.unit_code === prev.unit_code)!;
    const nextEmail = (next.access_user ?? "").trim().toLowerCase();
    const prevEmail = String(prev.access_user ?? "").trim().toLowerCase();
    if (
      prevEmail &&
      nextEmail &&
      prevEmail !== nextEmail &&
      (prev.provision_user_id || prev.access_user)
    ) {
      await revokeClientUnitAccess(prev);
    }
  }

  const removedIds = (existingUnits ?? [])
    .filter((prev) => !nextCodes.has(prev.unit_code))
    .map((prev) => prev.id);
  if (removedIds.length > 0) {
    const { error: deleteErr } = await admin.from("client_units").delete().in("id", removedIds);
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 400 });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = [];
  for (const row of rows) {
    const existing = existingByCode.get(row.unit_code);
    if (existing) {
      const { data: updated, error: updateErr } = await admin
        .from("client_units")
        .update(row)
        .eq("id", existing.id)
        .select()
        .single();
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 });
      }
      data.push(updated);
    } else {
      const { data: inserted, error: insertErr } = await admin
        .from("client_units")
        .insert(row)
        .select()
        .single();
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 400 });
      }
      data.push(inserted);
    }
  }

  if (units.length === 0) {
    return NextResponse.json({ ok: true, units: [] });
  }

  await syncNodeEmailAccessForClient(admin, clientId);

  type ProvisionResultRow = {
    unit_code: string;
    ok: boolean;
    user_id?: string;
    error?: string;
    existing?: boolean;
  };

  const provisionResults: ProvisionResultRow[] = [];

  if (runProvision && clientName) {
    for (const unit of data ?? []) {
      const nodeDef = NODES.find((node) => node.code === unit.unit_code);
      const accessUser = String(unit.access_user ?? "").trim();
      const accessPassword = String(unit.access_password ?? "").trim();
      const plan = String(unit.plan ?? "").trim() || "starter";

      if (!nodeDef?.provisionable) continue;
      // An email with no manually-typed password is the normal case when
      // adding a nodo to an existing client — fall back to a temp password +
      // activation link instead of silently skipping provisioning (which
      // used to leave the unit with no auth user and no way to log in).
      if (!accessUser) continue;
      if (unit.status === "pausado") continue;
      if (unit.provision_user_id) continue;

      const result = accessPassword
        ? await provisionNodoAccess({
            nodoCode: unit.unit_code,
            clientName,
            email: accessUser,
            password: accessPassword,
            plan,
          })
        : await provisionNodoAccessPendingPassword({
            nodoCode: unit.unit_code,
            clientName,
            email: accessUser,
            plan,
          });

      if (result.ok && result.user_id) {
        await admin
          .from("client_units")
          .update({
            provisioned_at: new Date().toISOString(),
            provision_user_id: result.user_id,
          })
          .eq("id", unit.id);

        unit.provisioned_at = new Date().toISOString();
        unit.provision_user_id = result.user_id;

        // This flow never sent any email before — the client_unit was
        // created and (sometimes) provisioned with no way for the person to
        // find out or log in. Send the same activation/link-existing-account
        // email the other admin flows already use.
        if (isMailConfigured()) {
          const nodeLabel = unit.unit_code;
          try {
            if (result.existing) {
              await sendNodeLinkedEmail({
                nombre: clientName,
                email: accessUser,
                nodeLabel,
                confirmUrl: `${origin}/login`,
                forgotPasswordUrl: `${origin}/${unit.unit_code.toLowerCase()}/login?mode=forgot`,
              });
            } else if (!accessPassword) {
              // Only the temp-password path needs an activation link — a
              // manually-set password means the admin already gave it to
              // the client out of band.
              await sendActivationEmail({
                nombre: clientName,
                email: accessUser,
                nodeLabel,
                activationUrl: `${origin}/${unit.unit_code.toLowerCase()}/login?mode=activate-invite`,
              });
            }
          } catch (mailErr) {
            console.error("[save-client-units] email error", mailErr);
          }
        }
      }

      provisionResults.push({
        unit_code: unit.unit_code,
        ok: result.ok,
        user_id: result.user_id,
        error: result.error,
        existing: result.existing,
      });
    }
  }

  return NextResponse.json({ ok: true, units: data ?? [], provision: provisionResults });
}
