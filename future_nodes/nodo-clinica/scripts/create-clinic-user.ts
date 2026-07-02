/**
 * Crear usuario médico o paciente vía API admin.
 *
 * Uso:
 *   CLINIC_ADMIN_SECRET=xxx pnpm exec tsx scripts/create-clinic-user.ts doctor "Nombre" email@ejemplo.com password
 *   CLINIC_ADMIN_SECRET=xxx pnpm exec tsx scripts/create-clinic-user.ts patient "Nombre" email@ejemplo.com password
 */

const base =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "http://localhost:3002";
const secret = process.env.CLINIC_ADMIN_SECRET?.trim();

async function main() {
  const [, , role, fullName, email, password] = process.argv;
  if (!secret) {
    console.error("Definí CLINIC_ADMIN_SECRET");
    process.exit(1);
  }
  if (!role || !fullName || !email || !password) {
    console.error(
      "Uso: tsx scripts/create-clinic-user.ts <doctor|patient> <nombre> <email> <password>",
    );
    process.exit(1);
  }

  const res = await fetch(`${base}/api/clinic/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-clinic-admin-secret": secret,
    },
    body: JSON.stringify({ role, fullName, email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Error:", data);
    process.exit(1);
  }
  console.log("OK:", JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
