import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Middleware for nodo-ecommerce.
 *
 * - Public paths: /, /auth/callback, /login, /(main)/*, /api/*
 * - Protected: /dashboard/* → redirect to /login if no session
 *
 * Note: with basePath "/ecommerce", Next.js strips the basePath before
 * the middleware sees the pathname (e.g., /ecommerce/dashboard → /dashboard).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  const isPublic =
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/") ||
    pathname === "/" ||
    !pathname.startsWith("/dashboard");

  if (isPublic) return NextResponse.next();

  // For /dashboard/* paths, verify session
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/ecommerce/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
