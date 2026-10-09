import { describe, expect, it } from "vitest";
import { pactadoRentAfterCobro, roundPesos, settleCobroRent } from "./pactado-rent-after-cobro";

describe("pactadoRentAfterCobro", () => {
  it("keeps alquiler pactado when cobrando, even if received is the cuota total", () => {
    expect(pactadoRentAfterCobro(false, 527400, 577400)).toBe(527400);
  });

  it("uses the edited rent when correcting a cobro already paid", () => {
    expect(pactadoRentAfterCobro(true, 527400, 530000)).toBe(530000);
  });

  it("drops IPC cents so the form and the pactado match", () => {
    expect(pactadoRentAfterCobro(false, 527400.03, 527400)).toBe(527400);
  });
});

describe("settleCobroRent", () => {
  it("marks the cuota paid when received matches the rounded pactado", () => {
    expect(
      settleCobroRent({
        isPaid: false,
        pactado: 527400.03,
        alreadyPaid: 0,
        received: 527400,
      }),
    ).toEqual({ amount: 527400, paidAmount: 527400, isFullyPaid: true });
  });

  it("closes leftover cents if a previous cobro already covered the rounded rent", () => {
    expect(
      settleCobroRent({
        isPaid: false,
        pactado: 527400.03,
        alreadyPaid: 527400,
        received: 0,
      }),
    ).toEqual({ amount: 527400, paidAmount: 527400, isFullyPaid: true });
  });
});

describe("roundPesos", () => {
  it("rounds 0.03 up away from the unpayable leftover", () => {
    expect(roundPesos(527400.03)).toBe(527400);
    expect(roundPesos(50_000.03)).toBe(50_000);
  });
});
