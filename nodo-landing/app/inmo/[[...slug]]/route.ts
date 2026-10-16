import { readFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  buildPublicPropertyOgTags,
  injectPublicPropertyOg,
} from "@/lib/inmo/inject-public-property-og";
import { loadPublicProperty } from "@/lib/inmo/load-public-property";

export const dynamic = "force-dynamic";

async function spaHtml(): Promise<string | null> {
  try {
    return readFileSync(path.join(process.cwd(), "public", "inmo", "index.html"), "utf-8");
  } catch {
    return null;
  }
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
      const property = await loadPublicProperty(slug[1]);
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
