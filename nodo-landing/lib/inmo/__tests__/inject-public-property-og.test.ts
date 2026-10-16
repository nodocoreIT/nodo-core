import { describe, expect, it } from "vitest";
import { buildPublicPropertyOgTags, injectPublicPropertyOg } from "../inject-public-property-og";

describe("public property OG tags", () => {
  it("includes title, image and escaped address", () => {
    const tags = buildPublicPropertyOgTags(
      {
        address: 'Cervantes "345"',
        operation: "sale",
        property_type: "apartment",
        sale_price: 67000,
        currency: "USD",
        localidad: "Santa Rosa",
        provincia: "La Pampa",
        photo_urls: ["https://cdn.example/foto.jpg"],
        agency: { legal_name: "Morán Villa" },
      },
      "https://www.nodocore.com.ar/inmo/p/abc",
    );
    expect(tags).toContain("Departamento en Venta · Cervantes &quot;345&quot;");
    expect(tags).toContain('property="og:image"');
    expect(tags).toContain("https://cdn.example/foto.jpg");
  });

  it("replaces the default SPA title", () => {
    const html = "<html><head><title>Nodo | Inmo</title></head></html>";
    const out = injectPublicPropertyOg(html, "<title>Ficha</title>");
    expect(out).toContain("<title>Ficha</title>");
    expect(out).not.toContain("Nodo | Inmo");
  });
});
