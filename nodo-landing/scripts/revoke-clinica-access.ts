/**
 * Revoca acceso al portal Nodo Clínica para un email (profesional + paciente).
 *
 * Uso:
 *   cd nodo-landing
 *   npx tsx --env-file=.env.local scripts/revoke-clinica-access.ts pela@pela.com
 *
 * Requiere: NODO_CLINICA_SUPABASE_URL, NODO_CLINICA_SERVICE_ROLE_KEY
 */

import { revokeClinicaPortalAccess } from "../lib/registration/clinica-provision";
import { setNodoAuthSuspended } from "../lib/registration/nodo-access-suspend";
import { createNodoAdminClient } from "../lib/supabase/nodo-admin";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Uso: npx tsx scripts/revoke-clinica-access.ts <email>");
    process.exit(1);
  }

  const admin = createNodoAdminClient("clinica");
  if (!admin) {
    console.error("NODO_CLINICA_SUPABASE_URL / NODO_CLINICA_SERVICE_ROLE_KEY no configurados.");
    process.exit(1);
  }

  let userId: string | null = null;
  const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = listData?.users?.find(
    (u) => String(u.email ?? "").toLowerCase() === email,
  );
  userId = found?.id ?? null;

  if (userId) {
    const banned = await setNodoAuthSuspended("clinica", userId, "suspend");
    if (!banned.ok) {
      console.error("Ban auth:", banned.error);
      process.exit(1);
    }
    console.log("Auth user banned:", userId);
  } else {
    console.warn("No auth user found for", email);
  }

  const revoked = await revokeClinicaPortalAccess({
    email,
    userId,
    portalRole: "both",
  });

  if (!revoked.ok) {
    console.error("Revoke portal:", revoked.error);
    process.exit(1);
  }

  console.log("Portal revocado para", email);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
