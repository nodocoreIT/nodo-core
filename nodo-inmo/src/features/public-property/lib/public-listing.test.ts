import { describe, expect, it } from "vitest";
import {
  publicListingMapQuery,
  publicListingTitle,
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

  it("builds a wa.me link from a formatted phone", () => {
    expect(whatsappConsultHref("+54 9 2954 62-3600", "Hola")).toBe(
      "https://wa.me/5492954623600?text=Hola",
    );
    expect(whatsappConsultHref("11", "Hola")).toBeNull();
  });
});
