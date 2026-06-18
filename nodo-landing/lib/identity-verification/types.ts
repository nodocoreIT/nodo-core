export type IdentityVerificationStatus =
  | "approved"
  | "declined"
  | "review"
  | "error"
  | "skipped";

export type IdentityVerificationInput = {
  firstName: string;
  lastName: string;
  /** Photo of the person holding their ID document next to their face. */
  holdingIdPhoto: Buffer;
  photoMimeType: string;
  documentNumber?: string;
  vendorData?: string;
};

export type IdentityVerificationResult = {
  status: IdentityVerificationStatus;
  outcomeCode: string;
  provider: string;
  requestId?: string;
  faceMatchScore?: number;
  message: string;
  raw?: unknown;
};

export interface IdentityVerificationProvider {
  readonly name: string;
  verify(input: IdentityVerificationInput): Promise<IdentityVerificationResult>;
}

export function normalizeDocumentNumber(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidArgentineDni(value: string): boolean {
  const digits = normalizeDocumentNumber(value);
  return digits.length >= 7 && digits.length <= 8;
}
