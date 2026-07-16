import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/medico/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If we had a next param pointing to password reset, redirect there with error
  if (next.includes("actualizar-contrasena")) {
    return NextResponse.redirect(`${origin}${next}?error=link_expired`);
  }
  return NextResponse.redirect(`${origin}/auth/login?error=auth`);
}
