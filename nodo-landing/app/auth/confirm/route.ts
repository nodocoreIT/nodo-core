import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Exchange Supabase recovery/sign-in tokens and redirect to the target page. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const redirectTarget = new URL(next, request.url);

  const fail = (message: string) => {
    redirectTarget.searchParams.set("error", message);
    return NextResponse.redirect(redirectTarget);
  };

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

  // Prefetch del cliente de mail o revisita sin token — volver al login sin error.
  return NextResponse.redirect(redirectTarget);
}
