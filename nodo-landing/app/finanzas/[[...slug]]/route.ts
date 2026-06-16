import { readFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";

// Catch-all handler for the nodo-finanzas SPA.
// Static assets (JS/CSS chunks) in public/finanzas/ are served directly by Next.js
// before this handler is reached. Only "real" SPA routes fall through here and
// receive index.html so React Router takes over.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const html = readFileSync(
      path.join(process.cwd(), "public", "finanzas", "index.html"),
      "utf-8",
    );
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return new NextResponse("Nodo Finanzas is not available — build may be missing.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
