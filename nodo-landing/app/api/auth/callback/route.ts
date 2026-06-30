import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  nodoSpaAuthCallbackPath,
  redirectUrlWithSessionHash,
} from "@/lib/supabase/nodo-spa-session-redirect";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/panel";

  if (code) {
    const spaCallback = nodoSpaAuthCallbackPath(next);

    if (spaCallback) {
      const ephemeral = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        },
      );

      const { data, error } = await ephemeral.auth.exchangeCodeForSession(code);
      if (!error && data?.session) {
        const email = data.user.email;
        const fullName =
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          email ||
          "Paciente Google";

        if (email) {
          const admin = createAdminClient();

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
                access_url: "https://www.nodocore.com.ar/clinica",
                access_user: email,
              });
            }
          }
        }

        return NextResponse.redirect(
          redirectUrlWithSessionHash(request.url, spaCallback, data.session),
        );
      }
    }

    const supabase = await createClient();
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
              access_url: "https://www.nodocore.com.ar/clinica",
              access_user: email,
            });
          }
        }
      }
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
