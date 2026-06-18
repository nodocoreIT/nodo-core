import { describe, it, expect } from "vitest";
import {
  ADMINISTRACION_INMOBILIARIA,
  ADMINISTRACION_INMOBILIARIA_SHORT,
  administracionInmobiliariaLabel,
} from "@/features/caja/lib/settlement-labels";

describe("administracionInmobiliariaLabel", () => {
  it("uses full label by default", () => {
    expect(administracionInmobiliariaLabel(10)).toBe(
      `${ADMINISTRACION_INMOBILIARIA} (10%)`,
    );
  });

  it("uses short label when space is constrained", () => {
    expect(administracionInmobiliariaLabel(8, { short: true })).toBe(
      `${ADMINISTRACION_INMOBILIARIA_SHORT} (8%)`,
    );
  });
});
