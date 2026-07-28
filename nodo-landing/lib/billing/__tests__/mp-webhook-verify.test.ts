import { createHmac } from "crypto";
import { describe, it, expect } from "vitest";
import { verifyMpWebhookSignature } from "../mp-webhook-verify";

const SECRET = "test-secret";

function signManifest(dataId: string, requestId: string, ts: string, secret: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

describe("verifyMpWebhookSignature", () => {
  it("accepts a correctly signed request", () => {
    const ts = "1700000000";
    const v1 = signManifest("invoice-1", "req-1", ts, SECRET);

    const valid = verifyMpWebhookSignature({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: "req-1",
      dataId: "invoice-1",
      secret: SECRET,
    });

    expect(valid).toBe(true);
  });

  it("rejects a signature signed with the wrong secret", () => {
    const ts = "1700000000";
    const v1 = signManifest("invoice-1", "req-1", ts, "wrong-secret");

    const valid = verifyMpWebhookSignature({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: "req-1",
      dataId: "invoice-1",
      secret: SECRET,
    });

    expect(valid).toBe(false);
  });

  it("rejects when the dataId doesn't match what was signed", () => {
    const ts = "1700000000";
    const v1 = signManifest("invoice-1", "req-1", ts, SECRET);

    const valid = verifyMpWebhookSignature({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: "req-1",
      dataId: "invoice-TAMPERED",
      secret: SECRET,
    });

    expect(valid).toBe(false);
  });

  it("rejects when x-signature header is missing", () => {
    const valid = verifyMpWebhookSignature({
      xSignature: null,
      xRequestId: "req-1",
      dataId: "invoice-1",
      secret: SECRET,
    });
    expect(valid).toBe(false);
  });

  it("rejects when x-request-id header is missing", () => {
    const valid = verifyMpWebhookSignature({
      xSignature: "ts=1700000000,v1=deadbeef",
      xRequestId: null,
      dataId: "invoice-1",
      secret: SECRET,
    });
    expect(valid).toBe(false);
  });

  it("rejects a malformed x-signature (no v1 part)", () => {
    const valid = verifyMpWebhookSignature({
      xSignature: "ts=1700000000",
      xRequestId: "req-1",
      dataId: "invoice-1",
      secret: SECRET,
    });
    expect(valid).toBe(false);
  });

  it("rejects when the secret is blank", () => {
    const ts = "1700000000";
    const v1 = signManifest("invoice-1", "req-1", ts, SECRET);
    const valid = verifyMpWebhookSignature({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: "req-1",
      dataId: "invoice-1",
      secret: "   ",
    });
    expect(valid).toBe(false);
  });
});
