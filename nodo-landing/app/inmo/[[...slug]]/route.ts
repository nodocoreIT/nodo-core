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
        const tags = buildPublicPropertyOgTags(property as never, request.url.split("?")[0]);
        const bootstrap = JSON.stringify(property).replace(/</g, "\\u003c");
        const themeRaw =
          property.theme_settings && typeof property.theme_settings === "object"
            ? (property.theme_settings as Record<string, unknown>)
            : {};
        const flyerTheme = {
          primaryColor: themeRaw.primaryColor,
          secondaryColor: themeRaw.secondaryColor,
          logoType: themeRaw.logoType,
          brandText: themeRaw.brandText,
        };
        const flyerJson = JSON.stringify(flyerTheme).replace(/</g, "\\u003c");
        const withOg = injectPublicPropertyOg(html, tags);
        return new NextResponse(
          withOg.replace(
            "</head>",
            `<script>window.__NODO_PUBLIC_PROPERTY__=${bootstrap};window.__NODO_FLYER_THEME__=${flyerJson};(function(){var t=window.__NODO_FLYER_THEME__||{};var r=document.documentElement;if(t.primaryColor)r.style.setProperty('--flyer-primary',t.primaryColor);if(t.secondaryColor)r.style.setProperty('--flyer-secondary',t.secondaryColor);})();</script></head>`,
          ),
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      }
    } catch {
      /* SPA still loads without OG */
    }
  }

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
