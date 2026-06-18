import type {
  IdentityVerificationInput,
  IdentityVerificationProvider,
  IdentityVerificationResult,
} from "../types";

/** No external API — photo queued for admin manual review. */
export const manualReviewProvider: IdentityVerificationProvider = {
  name: "manual_review",

  async verify(input: IdentityVerificationInput): Promise<IdentityVerificationResult> {
    if (!input.holdingIdPhoto.length) {
      return {
        status: "declined",
        outcomeCode: "PHOTO_MISSING",
        provider: "manual_review",
        message: "Subí una foto sosteniendo tu DNI junto a tu rostro.",
      };
    }

    if (input.holdingIdPhoto.length < 10_000) {
      return {
        status: "review",
        outcomeCode: "PHOTO_LOW_QUALITY",
        provider: "manual_review",
        message: "La foto parece de baja calidad. Un administrador la revisará manualmente.",
      };
    }

    return {
      status: "review",
      outcomeCode: "PENDING_MANUAL_REVIEW",
      provider: "manual_review",
      message:
        "Foto recibida. Un administrador verificará que coincida con tu identidad antes de habilitar el acceso.",
    };
  },
};
