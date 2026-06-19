import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient, type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getNodoPublicAuthConfig } from "@/lib/supabase/nodo-auth-config";
import {
  nodoSpaAuthCallbackPath,
  redirectUrlWithSessionHash,
} from "@/lib/supabase/nodo-spa-session-redirect";

function createEphemeralAuthClient(url: string, anonKey: string) {
  return createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/** Exchange Supabase recovery/sign-in tokens and redirect to the target page. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const project = searchParams.get("project");

  const redirectTarget = new URL(next, request.url);

  const fail = (message: string) => {
    redirectTarget.searchParams.set("error", message);
    return NextResponse.redirect(redirectTarget);
  };

  if (project) {
    const cfg = getNodoPublicAuthConfig(project);
    if (!cfg) return fail("Proyecto de autenticación no configurado.");

    const ephemeral = createEphemeralAuthClient(cfg.url, cfg.anonKey);
    const spaCallback = nodoSpaAuthCallbackPath(next);

    if (code) {
      const { data, error } = await ephemeral.auth.exchangeCodeForSession(code);
      if (error || !data.session) {
        return fail("El enlace expiró o ya fue usado. Solicitá uno nuevo.");
      }
      if (spaCallback) {
        return NextResponse.redirect(
          redirectUrlWithSessionHash(request.url, spaCallback, data.session, type ? { type } : undefined),
        );
      }
      return NextResponse.redirect(redirectTarget);
    }

    if (token_hash && type) {
      const { data, error } = await ephemeral.auth.verifyOtp({ type, token_hash });
      if (error || !data.session) {
        return fail("El enlace expiró o ya fue usado. Solicitá uno nuevo.");
      }
      if (spaCallback) {
        return NextResponse.redirect(
          redirectUrlWithSessionHash(request.url, spaCallback, data.session, { type }),
        );
      }
      return NextResponse.redirect(redirectTarget);
    }

    return NextResponse.redirect(redirectTarget);
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return fail("El enlace expiró o ya fue usado. Solicitá uno nuevo.");
    }
    return NextResponse.redirect(redirectTarget);
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error) {
      return fail("El enlace expiró o ya fue usado. Solicitá uno nuevo.");
    }
    return NextResponse.redirect(redirectTarget);
  }

  return NextResponse.redirect(redirectTarget);
}
