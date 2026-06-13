import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/panel";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore cookie set errors in server components
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      const email = data.user.email;
      const fullName =
        data.user.user_metadata?.full_name ||
        data.user.user_metadata?.name ||
        email ||
        "Paciente Google";

      if (email) {
        const admin = createAdminClient();

        // 1. Get or create the client
        const { data: existingClient } = await admin
          .from("clients")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        let clientId = existingClient?.id;

        if (!clientId) {
          const { data: newClient, error: clientErr } = await admin
            .from("clients")
            .insert({
              name: fullName,
              email: email,
            })
            .select("id")
            .single();

          if (!clientErr && newClient) {
            clientId = newClient.id;
          }
        }

        // 2. Get or create client unit for NODO Salud as paciente
        if (clientId) {
          const { data: existingUnit } = await admin
            .from("client_units")
            .select("id")
            .eq("client_id", clientId)
            .eq("unit_code", "salud")
            .eq("plan", "paciente")
            .maybeSingle();

          if (!existingUnit) {
            await admin.from("client_units").insert({
              client_id: clientId,
              unit_code: "salud",
              plan: "paciente",
              status: "activo",
              progress: 100,
              access_url: "https://nodo-clinica.fly.dev/",
              access_user: email,
            });
          }
        }
      }
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
