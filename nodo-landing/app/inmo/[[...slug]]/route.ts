import { readFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  buildPublicPropertyOgTags,
  injectPublicPropertyOg,
} from "@/lib/inmo/inject-public-property-og";

export const dynamic = "force-dynamic";

async function spaHtml(): Promise<string | null> {
  try {
    return readFileSync(path.join(process.cwd(), "public", "inmo", "index.html"), "utf-8");
  } catch {
    return null;
  }
}

async function fetchPublicProperty(token: string) {
  const base =
    process.env.NEXT_PUBLIC_NODO_INMO_SUPABASE_URL ?? process.env.NODO_INMO_SUPABASE_URL;
  const anon =
    process.env.NEXT_PUBLIC_NODO_INMO_SUPABASE_ANON_KEY ?? process.env.NODO_INMO_SUPABASE_ANON_KEY;
  if (!base || !anon) return null;
  const res = await fetch(
    `${base.replace(/\/$/, "")}/functions/v1/public-property?token=${encodeURIComponent(token)}`,
    {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    },
  );
  if (!res.ok) return null;
  return res.json();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug?: string[] }> },
) {
  const html = await spaHtml();
  if (!html) {
    return new NextResponse("Nodo Inmo is not available — build may be missing.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const { slug = [] } = await context.params;
  if (slug[0] === "p" && slug[1]) {
    try {
      const property = await fetchPublicProperty(slug[1]);
      if (property) {
        const tags = buildPublicPropertyOgTags(property, request.url.split("?")[0]);
        return new NextResponse(injectPublicPropertyOg(html, tags), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
    } catch {
      /* SPA still loads without OG */
    }
  }

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
