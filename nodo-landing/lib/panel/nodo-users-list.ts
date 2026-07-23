import { createAdminClient } from "@/lib/supabase/admin";
import { createNodoAdminClient, getNodoAuthConfig } from "@/lib/supabase/nodo-admin";
import { getNodeMailLabelByCode, NODES } from "@/lib/nodes";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NodoUserAccessType = "suscripcion" | "registro_gratuito" | "invitacion_equipo";

export type NodoUserRecord = {
  id: string;
  email: string;
  fullName: string | null;
  unitCode: string;
  unitLabel: string;
  role: string | null;
  accessType: NodoUserAccessType;
  status: string;
  clientId: string | null;
  clientUnitId: string | null;
  authUserId: string | null;
  orgName: string | null;
  orgId: string | null;
  plan: string | null;
  createdAt: string | null;
  authBanned: boolean;
};

type AuthUserInfo = { email: string; fullName: string | null; banned: boolean };

const PRODUCT_TO_UNIT_CODE: Record<string, string> = {
  inmo: "Inmo",
  "nodo-inmo": "Inmo",
  autos: "Autos",
  "nodo-autos": "Autos",
  finanzas: "Finanzas",
  "nodo-finanzas": "Finanzas",
  ecommerce: "Ecommerce",
  "nodo-ecommerce": "Ecommerce",
  salud: "Clínica",
  clinica: "Clínica",
  "nodo-clinica": "Clínica",
  "nodo-salud": "Clínica",
};

const ORG_MEMBER_NODO_CODES = ["inmo", "autos", "ecommerce", "finanzas"] as const;

const AUTH_BATCH_SIZE = 100;

function normalizeUnitCode(unitCode: string): string {
  return unitCode.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function userKey(email: string, unitCode: string): string {
  return `${email.trim().toLowerCase()}::${normalizeUnitCode(unitCode)}`;
}

/** Clinic allows the same email as paciente and médico — dedupe per portal role. */
function clinicProfileKey(email: string, unitCode: string, role: "paciente" | "medico"): string {
  return `${userKey(email, unitCode)}::${role}`;
}

function nodoUserDedupeKey(row: NodoUserRecord): string {
  if (row.id.startsWith("clinic-patient:") || row.id.startsWith("clinic-medico:")) {
    return row.id;
  }
  return userKey(row.email, row.unitCode);
}

function inferAccessType(plan: string | null, unitCode: string): NodoUserAccessType {
  const code = normalizeUnitCode(unitCode);
  const p = (plan ?? "").trim().toLowerCase();
  if (code === "clinica" || code === "salud") {
    if (!p || p === "paciente" || p.includes("paciente") || p.includes("libre")) {
      return "registro_gratuito";
    }
  }
  return "suscripcion";
}

function unitLabel(unitCode: string): string {
  return getNodeMailLabelByCode(unitCode);
}

function unitCodeFromProduct(product: string | null | undefined): string | null {
  if (!product) return null;
  const normalized = product.trim().toLowerCase();
  return PRODUCT_TO_UNIT_CODE[normalized] ?? null;
}

function asSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function uniqueNodoAdminClients(
  nodoCodes: readonly string[],
): Array<{ nodoCode: string; admin: SupabaseClient }> {
  const byUrl = new Map<string, { nodoCode: string; admin: SupabaseClient }>();

  for (const nodoCode of nodoCodes) {
    const config = getNodoAuthConfig(nodoCode);
    if (!config || byUrl.has(config.url)) continue;

    const admin = createNodoAdminClient(nodoCode);
    if (admin) byUrl.set(config.url, { nodoCode, admin });
  }

  return [...byUrl.values()];
}

/** Batch lookup on auth.users — O(n/batch) instead of N sequential getUserById calls. */
async function fetchAuthUserMap(
  admin: SupabaseClient | null,
  userIds: string[],
): Promise<Map<string, AuthUserInfo>> {
  const map = new Map<string, AuthUserInfo>();
  if (!admin || userIds.length === 0) return map;

  const unique = [...new Set(userIds.filter(Boolean))];

  for (let i = 0; i < unique.length; i += AUTH_BATCH_SIZE) {
    const batch = unique.slice(i, i + AUTH_BATCH_SIZE);
    const { data, error } = await admin
      .schema("auth")
      .from("users")
      .select("id, email, raw_user_meta_data, banned_until")
      .in("id", batch);

    if (error) {
      console.error("[nodo-users] auth.users batch", error);
      continue;
    }

    for (const row of data ?? []) {
      const meta = row.raw_user_meta_data as Record<string, unknown> | undefined;
      map.set(row.id as string, {
        email: String(row.email ?? "").toLowerCase(),
        fullName: typeof meta?.full_name === "string" ? meta.full_name : null,
        banned: Boolean(row.banned_until && new Date(row.banned_until as string) > new Date()),
      });
    }
  }

  return map;
}

async function applyClinicAuthBanStatus(rows: NodoUserRecord[]): Promise<void> {
  const clinicAdmin = createNodoAdminClient("clinica");
  const clinicRows = rows.filter((r) => r.id.startsWith("clinic-") && r.authUserId);
  if (!clinicAdmin || clinicRows.length === 0) return;

  const authMap = await fetchAuthUserMap(
    clinicAdmin,
    clinicRows.map((r) => r.authUserId as string),
  );

  for (const row of clinicRows) {
    const auth = authMap.get(row.authUserId as string);
    if (!auth) continue;
    row.authBanned = auth.banned;
    if (auth.banned) row.status = "suspendido";
  }
}

async function listFromClientUnits(): Promise<NodoUserRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_units")
    .select(
      "id, unit_code, plan, status, provision_user_id, access_user, created_at, client_id, clients ( name, email )",
    )
    .not("access_user", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[nodo-users] client_units", error);
    return [];
  }

  return (data ?? []).map((unit) => {
    const client = asSingleRelation(
      unit.clients as { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null,
    );
    const email = String(unit.access_user ?? "").trim().toLowerCase();
    const unitCode = String(unit.unit_code ?? "");

    return {
      id: `unit:${unit.id}`,
      email,
      fullName: client?.name ?? null,
      unitCode,
      unitLabel: unitLabel(unitCode),
      role: null,
      accessType: inferAccessType((unit.plan as string) ?? null, unitCode),
      status: String(unit.status ?? "activo"),
      clientId: unit.client_id as string,
      clientUnitId: unit.id as string,
      authUserId: (unit.provision_user_id as string) ?? null,
      orgName: null,
      orgId: null,
      plan: (unit.plan as string) ?? null,
      createdAt: (unit.created_at as string) ?? null,
      authBanned: false,
    };
  });
}

async function listFromClinicaProfiles(existingKeys: Set<string>): Promise<NodoUserRecord[]> {
  const clinicDb = createAdminClient("nodo_clinica");
  const unitCode = "Clínica";
  const rows: NodoUserRecord[] = [];

  const [{ data: patients }, { data: professionals }] = await Promise.all([
    clinicDb
      .from("patients")
      .select("id, full_name, email, profile_id, subscription_plan, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    clinicDb
      .from("professionals")
      .select("id, full_name, email, user_id, specialty, subscription_status, subscription_plan, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  for (const p of patients ?? []) {
    const email = String(p.email ?? "").trim().toLowerCase();
    if (!email || email.includes("@deleted.local")) continue;

    const profileKey = clinicProfileKey(email, unitCode, "paciente");
    const accessKey = userKey(email, unitCode);
    if (existingKeys.has(profileKey) || existingKeys.has(accessKey)) continue;
    existingKeys.add(profileKey);

    rows.push({
      id: `clinic-patient:${p.id}`,
      email,
      fullName: p.full_name as string,
      unitCode,
      unitLabel: unitLabel(unitCode),
      role: "paciente",
      accessType: "registro_gratuito",
      status: "activo",
      clientId: null,
      clientUnitId: null,
      authUserId: (p.profile_id as string) ?? null,
      orgName: null,
      orgId: null,
      plan: (p.subscription_plan as string) ?? "paciente",
      createdAt: (p.created_at as string) ?? null,
      authBanned: false,
    });
  }

  for (const prof of professionals ?? []) {
    const email = String(prof.email ?? "").trim().toLowerCase();
    if (!email || email.includes("@deleted.local")) continue;

    const profileKey = clinicProfileKey(email, unitCode, "medico");
    if (existingKeys.has(profileKey)) continue;
    existingKeys.add(profileKey);

    rows.push({
      id: `clinic-medico:${prof.id}`,
      email,
      fullName: prof.full_name as string,
      unitCode,
      unitLabel: unitLabel(unitCode),
      role: "medico",
      accessType: inferAccessType((prof.subscription_plan as string) ?? null, unitCode),
      status: String(prof.subscription_status ?? "activo"),
      clientId: null,
      clientUnitId: null,
      authUserId: (prof.user_id as string) ?? null,
      orgName: null,
      orgId: null,
      plan: (prof.subscription_plan as string) ?? null,
      createdAt: (prof.created_at as string) ?? null,
      authBanned: false,
    });
  }

  return rows;
}

async function listFromOrgMembers(existingKeys: Set<string>): Promise<NodoUserRecord[]> {
  const sources = uniqueNodoAdminClients(ORG_MEMBER_NODO_CODES);
  if (sources.length === 0) return [];

  const rows: NodoUserRecord[] = [];

  await Promise.all(
    sources.map(async ({ nodoCode, admin }) => {
      const { data: members, error } = await admin
        .schema("shared")
        .from("org_members")
        .select("user_id, role, org_id, created_at, organizations ( name, product )")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        console.error(`[nodo-users] org_members (${nodoCode})`, error);
        return;
      }

      const memberList = members ?? [];
      if (memberList.length === 0) return;

      const userIds = [...new Set(memberList.map((m) => m.user_id as string).filter(Boolean))];

      const [{ data: profiles }, authMap] = await Promise.all([
        admin.schema("shared").from("user_profiles").select("id, full_name").in("id", userIds),
        fetchAuthUserMap(admin, userIds),
      ]);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? null]),
      );

      for (const member of memberList) {
        const userId = member.user_id as string;
        const org = asSingleRelation(
          member.organizations as { name: string; product: string } | { name: string; product: string }[] | null,
        );
        const product = org?.product ?? "";
        const unitCode = unitCodeFromProduct(product);
        if (!unitCode) continue;

        const nodeDef = NODES.find((n) => n.code === unitCode);
        if (!nodeDef || nodeDef.inDevelopment) continue;

        const auth = authMap.get(userId);
        const email = auth?.email ?? "";
        if (!email) continue;

        const key = userKey(email, unitCode);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);

        const productSlug = product.trim().toLowerCase().replace(/^nodo-/, "") || nodoCode;

        rows.push({
          id: `member:${productSlug}:${userId}:${member.org_id}`,
          email,
          fullName: profileMap.get(userId) ?? auth?.fullName ?? null,
          unitCode,
          unitLabel: unitLabel(unitCode),
          role: String(member.role ?? ""),
          accessType: "invitacion_equipo",
          status: auth?.banned ? "suspendido" : "activo",
          clientId: null,
          clientUnitId: null,
          authUserId: userId,
          orgName: org?.name ?? null,
          orgId: member.org_id as string,
          plan: null,
          createdAt: (member.created_at as string) ?? null,
          authBanned: auth?.banned ?? false,
        });
      }
    }),
  );

  return rows;
}

export async function listNodoUsers(): Promise<NodoUserRecord[]> {
  const fromAccess = await listFromClientUnits();
  const keys = new Set(fromAccess.map((u) => userKey(u.email, u.unitCode)));

  const [fromClinic, fromMembers] = await Promise.all([
    listFromClinicaProfiles(keys),
    listFromOrgMembers(keys),
  ]);

  const merged = [...fromAccess, ...fromClinic, ...fromMembers];

  const seen = new Set<string>();
  const combined = merged.filter((row) => {
    const key = nodoUserDedupeKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await applyClinicAuthBanStatus(combined);

  combined.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  return combined;
}
