import { readFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";

// Catch-all handler for the nodo-autos SPA.
// Static assets (JS/CSS chunks) in public/autos/ are served directly by Next.js
// before this handler is reached. Only "real" SPA routes fall through here and
// receive index.html so React Router takes over.
export const dynamic = "force-dynamic";

export async function GET() {
  const html = readFileSync(
    path.join(process.cwd(), "public", "autos", "index.html"),
    "utf-8",
  );
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
