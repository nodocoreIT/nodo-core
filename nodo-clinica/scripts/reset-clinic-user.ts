/**
 * Crear o resetear usuario en producción vía API admin.
 *
 * PowerShell:
 *   $secret = "tu_CLINIC_ADMIN_SECRET"
 *   $body = @{
 *     action = "upsert"
 *     role = "doctor"
 *     email = "juanmendia@gmail.com"
 *     password = "Peladin18"
 *     fullName = "Juan Esteban Mendia"
 *   } | ConvertTo-Json
 *   Invoke-RestMethod -Uri "https://nodo-salud.vercel.app/api/clinic/admin/users" `
 *     -Method PATCH -Body $body -ContentType "application/json" `
 *     -Headers @{ "x-clinic-admin-secret" = $secret }
 */

const base =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://nodo-salud.vercel.app";
const secret = process.env.CLINIC_ADMIN_SECRET?.trim();

async function main() {
  const [, , role, fullName, email, password] = process.argv;
  if (!secret) {
    console.error("Definí CLINIC_ADMIN_SECRET");
    process.exit(1);
  }
  if (!role || !fullName || !email || !password) {
    console.error(
      "Uso: CLINIC_ADMIN_SECRET=xxx tsx scripts/reset-clinic-user.ts <doctor|patient> <nombre> <email> <password>",
    );
    process.exit(1);
  }

  const res = await fetch(`${base}/api/clinic/admin/users`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-clinic-admin-secret": secret,
    },
    body: JSON.stringify({
      action: "upsert",
      role,
      fullName,
      email,
      password,
    }),
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
