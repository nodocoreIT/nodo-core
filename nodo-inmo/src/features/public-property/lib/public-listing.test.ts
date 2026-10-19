import { describe, expect, it } from "vitest";
import {
  parseAgencyPhones,
  publicListingMapQuery,
  publicListingTheme,
  publicListingTitle,
  toWhatsAppNumber,
  whatsappConsultHref,
} from "./public-listing";

describe("public listing copy", () => {
  it("builds a shareable title from type, operation and address", () => {
    expect(
      publicListingTitle({
        property_type: "apartment",
        operation: "sale",
        address: "Cervantes 345",
      }),
    ).toBe("Departamento en Venta · Cervantes 345");
  });

  it("builds a map query with Argentina", () => {
    expect(
      publicListingMapQuery({
        address: "Cervantes 345",
        localidad: "Santa Rosa",
        provincia: "La Pampa",
      }),
    ).toBe("Cervantes 345, Santa Rosa, La Pampa, Argentina");
  });

  it("uses the agency theme colors on the public flyer", () => {
    const theme = publicListingTheme({
      theme_settings: { primaryColor: "#228B22", secondaryColor: "#0f3d2e" },
    } as Parameters<typeof publicListingTheme>[0]);
    expect(theme.primaryColor).toBe("#228B22");
    expect(theme.secondaryColor).toBe("#0f3d2e");
  });

  it("reads branding from the share query when the API has no theme", () => {
    const theme = publicListingTheme({} as Parameters<typeof publicListingTheme>[0], "pc=124304&sc=003000");
    expect(theme.primaryColor).toBe("#124304");
    expect(theme.secondaryColor).toBe("#003000");
  });

  it("builds a WhatsApp link from a formatted phone", () => {
    expect(whatsappConsultHref("+54 9 2954 62-3600", "Hola")).toBe(
      "https://api.whatsapp.com/send?phone=5492954623600&text=Hola",
    );
    expect(whatsappConsultHref("11", "Hola")).toBeNull();
  });

  it("uses only the first number when the agency stored two phones", () => {
    expect(parseAgencyPhones("2954586125 / 2954362150")).toEqual([
      "2954586125",
      "2954362150",
    ]);
    expect(toWhatsAppNumber("2954586125")).toBe("5492954586125");
    expect(whatsappConsultHref("2954586125 / 2954362150", "Hola")).toBe(
      "https://api.whatsapp.com/send?phone=5492954586125&text=Hola",
    );
  });
});
