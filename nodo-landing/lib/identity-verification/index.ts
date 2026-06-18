import type { IdentityVerificationProvider } from "./types";
import { manualReviewProvider } from "./providers/manual-review";
import { createAiVisionProvider } from "./providers/ai-vision";

export * from "./types";
export { requiresIdentityVerification } from "@/lib/registration/node-config";

/**
 * Identity check providers:
 * - ai_vision (when OPENAI_API_KEY set): compares face vs DNI in holding photo
 * - manual_review (default): admin reviews photo, no API cost
 *
 * Didit/RENAPER parked for future — see providers/didit-renaper.ts
 */
export function getIdentityVerificationProvider(): IdentityVerificationProvider {
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return createAiVisionProvider(openAiKey, process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini");
  }
  return manualReviewProvider;
}

export function isIdentityVerificationEnabled(): boolean {
  return process.env.IDENTITY_VERIFICATION_DISABLED !== "true";
}
