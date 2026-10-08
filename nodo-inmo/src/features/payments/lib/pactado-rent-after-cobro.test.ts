import { describe, expect, it } from "vitest";
import { pactadoRentAfterCobro } from "./pactado-rent-after-cobro";

describe("pactadoRentAfterCobro", () => {
  it("keeps alquiler pactado when cobrando, even if received is the cuota total", () => {
    expect(pactadoRentAfterCobro(false, 527400, 577400)).toBe(527400);
  });

  it("uses the edited rent when correcting a cobro already paid", () => {
    expect(pactadoRentAfterCobro(true, 527400, 530000)).toBe(530000);
  });
});
