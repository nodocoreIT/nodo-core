import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { panelSupabaseClientOptions } from "@/lib/supabase/panel-auth";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // If Supabase isn't configured, don't crash every request — just pass through.
  // The /panel layout still guards access on its own.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      ...panelSupabaseClientOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (request.nextUrl.pathname.startsWith("/panel")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Roles restricted to a subset of the panel (e.g. QA — testing access
    // only, not the full admin surface). Team members with no entry here
    // keep full access, same as before this check existed.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const allowedPrefixes = RESTRICTED_ROLE_PANEL_ACCESS[profile?.role ?? ""];
    if (
      allowedPrefixes &&
      !allowedPrefixes.some(
        (prefix) =>
          request.nextUrl.pathname === prefix ||
          request.nextUrl.pathname.startsWith(`${prefix}/`),
      )
    ) {
      const url = request.nextUrl.clone();
      url.pathname = allowedPrefixes[0];
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

/** Panel paths a restricted role may reach — everything else redirects to the first entry. */
const RESTRICTED_ROLE_PANEL_ACCESS: Record<string, string[]> = {
  qa: ["/panel/tareas", "/panel/ideas"],
};
