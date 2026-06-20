import { NextRequest, NextResponse } from "next/server";
import { getStoreByDomain } from "@/lib/get-store";

// Default store domain (e.g. store.nodocore.com or tienda.nodocore.com)
const STORE_DOMAIN = process.env.STORE_DOMAIN ?? "localhost:3001";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Next.js internals and static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Get the hostname from the request
  const hostname = request.headers.get("host") ?? "";

  // Remove port for comparison
  const hostWithoutPort = hostname.split(":")[0];
  const storeDomainWithoutPort = STORE_DOMAIN.split(":")[0];

  let storeSlug: string | null = null;

  // Check if it's the default store domain with a subdomain
  // e.g. mi-tienda.store.nodocore.com → slug = "mi-tienda"
  if (hostWithoutPort.endsWith(`.${storeDomainWithoutPort}`)) {
    storeSlug = hostWithoutPort.replace(`.${storeDomainWithoutPort}`, "");
  }
  // Check if it's localhost dev (e.g. localhost:3001/mi-tienda/...)
  // In dev, the slug is extracted from the path prefix
  else if (
    hostname.includes("localhost") ||
    hostname.includes("127.0.0.1")
  ) {
    // In local dev, we serve by path prefix — no rewrite needed
    return NextResponse.next();
  }
  // Otherwise treat as a custom domain — look up in DB
  else {
    try {
      const store = await getStoreByDomain(hostname);
      if (!store) {
        return new NextResponse("Store not found", { status: 404 });
      }
      storeSlug = store.slug;
    } catch {
      return new NextResponse("Internal error", { status: 500 });
    }
  }

  if (!storeSlug) {
    return NextResponse.next();
  }

  // Rewrite to /[storeSlug]/pathname
  const url = request.nextUrl.clone();
  url.pathname = `/${storeSlug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
