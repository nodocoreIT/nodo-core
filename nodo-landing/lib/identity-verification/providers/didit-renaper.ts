import type {
  IdentityVerificationInput,
  IdentityVerificationProvider,
  IdentityVerificationResult,
} from "../types";
import { normalizeDocumentNumber } from "../types";

const DIDIT_URL = "https://verification.didit.me/v3/database-validation/";

type DiditValidation = {
  outcome_code?: string;
  service_id?: string;
  source_data?: { face_match_score?: string };
};

type DiditResponse = {
  request_id?: string;
  status?: string;
  match_type?: string;
  validations?: DiditValidation[];
};

function mapDiditResult(data: DiditResponse): IdentityVerificationResult {
  const validation = data.validations?.find((v) => v.service_id === "arg_renaper");
  const outcome = validation?.outcome_code ?? "UNKNOWN";
  const scoreRaw = validation?.source_data?.face_match_score;
  const faceMatchScore = scoreRaw ? Number.parseFloat(scoreRaw) : undefined;

  if (outcome === "MATCH") {
    return {
      status: "approved",
      outcomeCode: outcome,
      provider: "didit_renaper",
      requestId: data.request_id,
      faceMatchScore,
      message: "Identidad verificada contra RENAPER.",
      raw: data,
    };
  }

  if (outcome === "BIOMETRIC_IMAGE_UNUSABLE") {
    return {
      status: "review",
      outcomeCode: outcome,
      provider: "didit_renaper",
      requestId: data.request_id,
      message: "No pudimos leer tu selfie. Sacá otra foto con buena luz, mirando a cámara.",
      raw: data,
    };
  }

  if (outcome === "BIOMETRIC_NO_MATCH") {
    return {
      status: "declined",
      outcomeCode: outcome,
      provider: "didit_renaper",
      requestId: data.request_id,
      faceMatchScore,
      message: "La selfie no coincide con la foto registrada en RENAPER.",
      raw: data,
    };
  }

  if (outcome === "NO_MATCH") {
    return {
      status: "declined",
      outcomeCode: outcome,
      provider: "didit_renaper",
      requestId: data.request_id,
      message: "Los datos no coinciden con el registro nacional (RENAPER).",
      raw: data,
    };
  }

  return {
    status: data.status === "In Review" ? "review" : "declined",
    outcomeCode: outcome,
    provider: "didit_renaper",
    requestId: data.request_id,
    message: "No se pudo completar la verificación de identidad.",
    raw: data,
  };
}

export function createDiditRenaperProvider(apiKey: string): IdentityVerificationProvider {
  return {
    name: "didit_renaper",

    async verify(input: IdentityVerificationInput): Promise<IdentityVerificationResult> {
      const form = new FormData();
      form.append("issuing_state", "ARG");
      form.append("services", "arg_renaper");
      form.append("document_number", normalizeDocumentNumber(input.documentNumber ?? ""));
      form.append("gender", input.gender ?? "X");
      form.append("first_name", input.firstName);
      form.append("last_name", input.lastName);
      if (input.vendorData) form.append("vendor_data", input.vendorData);

      const blob = new Blob([Uint8Array.from(input.holdingIdPhoto)], {
        type: input.photoMimeType || "image/jpeg",
      });
      form.append("selfie", blob, "selfie.jpg");

      const res = await fetch(DIDIT_URL, {
        method: "POST",
        headers: { "x-api-key": apiKey },
        body: form,
      });

      const data = (await res.json().catch(() => ({}))) as DiditResponse & { detail?: string };

      if (!res.ok) {
        return {
          status: "error",
          outcomeCode: "API_ERROR",
          provider: "didit_renaper",
          message: data.detail ?? "Error al consultar RENAPER.",
          raw: data,
        };
      }

      return mapDiditResult(data);
    },
  };
}
